#!/usr/bin/env python3
"""Vessel NMEA ingest — issues #37 / #45; failover lessons from #49.

Why this exists (not another 15s command_line poll): measured live 2026-08-15
that the wind instrument transmits a fresh MWV reading every ~0.5s (~2Hz), but
the existing `nmea_gateways.py` pipeline (a) only opens its TCP connection for
a ~2s sample once every 15s (command_line scan_interval) -- blind ~87% of the
time -- and (b) even during that ~2s window keeps only the *last* line seen,
discarding the ~3 other readings that arrived. A short (1-2s) gust has a real
chance of being missed entirely, not just smoothed.

This process stays connected continuously, tracks a real rolling gust max
in-memory (full ~2Hz resolution, nothing discarded), and publishes over MQTT
at a throttled ~1Hz -- decoupling *sampling* (continuous) from *reporting*
(deliberately lazy, no point flooding InfluxDB/HA at 2Hz for a wind reading).

Reuses parse_nmea() from nmea_gateways.py (bind-mounted into this container,
see docker-compose*.yml) rather than re-implementing NMEA sentence parsing --
one source of truth, no drift between the two pipelines.

#45 kernel ingest
  Dual-listen: stay connected to YDWG *and* DataHub. Merge **per signal**
  (YDWG if that field is fresh, else DataHub). Never treat TCP-open-but-mute
  as live. Engines and air temp are YDWG-only. DataHub $IIMWD >360 is
  rejected in parse_nmea (DHXDR MWD radians is the usable DataHub TWD).
  Publishes JSON {value, source, stale_s} on sisu/v1/<domain>/<qty> and
  keeps the old sisu/nmea/wind/* float aliases so existing HA sensors
  keep working until #46 retires the twins.

#49 (do not undo)
  Per-connection stale detector: a successful connect() is not proof of a
  healthy gateway. YDWG-02 was found accepting TCP with its NMEA process
  dead; the old single-socket rotate + process-restart watchdog kept
  retrying YDWG and never reached DataHub. Each socket here has its own
  CONNECTION_STALE_SECONDS mute rotate (reconnect that socket). There is
  no whole-process failback-via-tcp_open — that was the flap vector, and
  dual-listen makes it unnecessary. Outer STALE_RESTART_SECONDS still
  exits if *both* gateways are mute, so Docker can take a clean slate.

True wind direction (twd) comes straight from the instrument's own MWD
(or DataHub DHXDR MWD rad), not a heading+AWA approximation.

Restart safeguards:
  1. Docker `restart: unless-stopped`
  2. Per-gateway reconnect loop with backoff
  3. Per-connection mute detector (CONNECTION_STALE_SECONDS)
  4. Stall watchdog (STALE_RESTART_SECONDS) if nothing from either gateway
  5. paho-mqtt automatic reconnect
  6. Heartbeat file for Docker healthcheck

Env vars (defaults match docker-compose.yml):
  YDWG_HOST, YDWG_PORT
  DATAHUB_HOST, DATAHUB_PORT
  MQTT_HOST, MQTT_PORT
  MQTT_TOPIC_PREFIX          (alias tree, default sisu/nmea/wind)
  MQTT_KERNEL_PREFIX         (kernel tree, default sisu/v1)
  PUBLISH_HZ                 (default 1.0)
  GUST_WINDOW_SECONDS        (default 5.0)
  FIELD_FRESH_SECONDS        (default 5 -- YDWG field still wins inside this)
  CONNECTION_STALE_SECONDS   (default 15 -- per-socket mute)
  STALE_RESTART_SECONDS      (default 60 -- both mute)
  HEARTBEAT_FILE
"""
from __future__ import annotations

import collections
import json
import logging
import math
import os
import socket
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, "/app")
import nmea_gateways  # noqa: E402  (mounted into the container, see compose files)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("nmea_wind_daemon")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

YDWG_HOST = os.environ.get("YDWG_HOST", "host.docker.internal")
YDWG_PORT = int(os.environ.get("YDWG_PORT", "1456"))
DATAHUB_HOST = os.environ.get("DATAHUB_HOST", "host.docker.internal")
DATAHUB_PORT = int(os.environ.get("DATAHUB_PORT", "11102"))

MQTT_HOST = os.environ.get("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_USER = os.environ.get("MQTT_USER", "")
MQTT_PASSWORD = os.environ.get("MQTT_PASSWORD", "")
MQTT_TOPIC_PREFIX = os.environ.get("MQTT_TOPIC_PREFIX", "sisu/nmea/wind")
MQTT_KERNEL_PREFIX = os.environ.get("MQTT_KERNEL_PREFIX", "sisu/v1")

PUBLISH_HZ = float(os.environ.get("PUBLISH_HZ", "1.0"))
GUST_WINDOW_SECONDS = float(os.environ.get("GUST_WINDOW_SECONDS", "5.0"))
FIELD_FRESH_SECONDS = float(os.environ.get("FIELD_FRESH_SECONDS", "5"))
CONNECTION_STALE_SECONDS = float(os.environ.get("CONNECTION_STALE_SECONDS", "15"))
STALE_RESTART_SECONDS = float(os.environ.get("STALE_RESTART_SECONDS", "60"))
HEARTBEAT_FILE = Path(os.environ.get("HEARTBEAT_FILE", "/tmp/nmea_wind_daemon.heartbeat"))

# Supervisor container-restart watchdog (#64) — distinct from the
# STALE_RESTART_SECONDS *data* stall watchdog above (that one makes this
# process exit cleanly when NMEA data goes stale; this one is what actually
# gets it running again). Supervisor's app-manifest `watchdog:` field only
# accepts an active tcp://[HOST]:port probe, not a plain restart-on-exit
# flag (confirmed against its own validate.py) - this process has no
# listening port otherwise (pure outbound MQTT/gateway client), so
# accept-and-close on a trivial port is what that probe polls.
SUPERVISOR_WATCHDOG_PORT = int(os.environ.get("SUPERVISOR_WATCHDOG_PORT", "8765"))

GATEWAYS = [
    {"id": "ydwg", "host": YDWG_HOST, "port": YDWG_PORT},
    {"id": "datahub", "host": DATAHUB_HOST, "port": DATAHUB_PORT},
]
SOURCE_ORDER = ("ydwg", "datahub")

# store_key -> (sisu/v1 path, ydwg_only)
# ydwg_only: engines never come from DataHub; air temp is YDWG XDR/MDA only.
KERNEL_MAP: list[tuple[str, str, bool]] = [
    ("aws_kn", "wind/aws", False),
    ("tws_kn", "wind/tws", False),
    ("awa_deg", "wind/awa", False),
    ("twa_deg", "wind/twa", False),
    ("twd_true_deg", "wind/twd", False),
    ("sog_kn", "nav/sog", False),
    ("cog_deg", "nav/cog", False),
    ("heading_true_deg", "nav/heading_true", False),
    ("heading_mag_deg", "nav/heading_mag", False),
    ("latitude", "nav/lat", False),
    ("longitude", "nav/lon", False),
    ("depth_m", "nav/depth", False),
    ("stw_kn", "nav/stw", False),
    ("rudder_deg", "nav/rudder", False),
    ("rot_deg_min", "nav/rot", False),
    ("log_nm", "nav/log", False),
    ("air_temp_c", "env/air_temp", True),
    ("water_temp_c", "env/water_temp", False),
    ("baro_hpa", "env/baro", False),
    ("pitch_deg", "env/pitch", False),
    ("roll_deg", "env/roll", False),
    ("yaw_deg", "env/yaw", True),
    ("engine_0_rpm", "engine/0/rpm", True),
    ("engine_1_rpm", "engine/1/rpm", True),
    ("engine_0_coolant_c", "engine/0/coolant", True),
    ("engine_1_coolant_c", "engine/1/coolant", True),
    ("engine_0_fuel_lph", "engine/0/fuel_rate", True),
    ("engine_1_fuel_lph", "engine/1/fuel_rate", True),
    ("engine_0_hours", "engine/0/hours", True),
    ("engine_1_hours", "engine/1/hours", True),
    ("engine_0_alt_v", "engine/0/alt_v", True),
    ("engine_1_alt_v", "engine/1/alt_v", True),
    ("engine_0_boost_bar", "engine/0/boost", True),
    ("engine_1_boost_bar", "engine/1/boost", True),
]

# Old float aliases kept until #46 retires nmea_*_live.
ALIAS_WIND = {
    "aws": "aws_kn",
    "tws": "tws_kn",
    "awa": "awa_deg",
    "twa": "twa_deg",
    "twd": "twd_true_deg",
}


# ---------------------------------------------------------------------------
# Rolling gust tracker
# ---------------------------------------------------------------------------


class GustTracker:
    """Tracks the current value and a rolling max over the last N seconds."""

    def __init__(self, window_seconds: float) -> None:
        self.window_seconds = window_seconds
        self._samples: collections.deque[tuple[float, float]] = collections.deque()
        self.current: float | None = None

    def add(self, value: float) -> None:
        now = time.time()
        self.current = value
        self._samples.append((now, value))
        cutoff = now - self.window_seconds
        while self._samples and self._samples[0][0] < cutoff:
            self._samples.popleft()

    def gust(self) -> float | None:
        if not self._samples:
            return None
        return max(v for _, v in self._samples)


# ---------------------------------------------------------------------------
# Per-signal store (YDWG first if fresh, else DataHub)
# ---------------------------------------------------------------------------


class FieldStore:
    """Last value+timestamp per (field, source). Pick is per-signal, not per-socket."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data: dict[str, dict[str, tuple[float, float]]] = {}

    def update(self, source: str, parsed: dict, ts: float) -> None:
        with self._lock:
            for key, val in parsed.items():
                if not isinstance(val, (int, float)) or isinstance(val, bool):
                    continue
                self._data.setdefault(key, {})[source] = (float(val), ts)

    def pick(
        self,
        key: str,
        now: float,
        ydwg_only: bool = False,
        max_age: float = FIELD_FRESH_SECONDS,
    ) -> tuple[float, str, float] | None:
        """Return (value, source, stale_s) or None.

        Prefer YDWG when that source's sample is younger than max_age; otherwise
        DataHub (unless ydwg_only). If nothing is fresh, still return the last
        Y-then-D value so consumers can see a large stale_s instead of silence.
        """
        order = ("ydwg",) if ydwg_only else SOURCE_ORDER
        with self._lock:
            by_src = dict(self._data.get(key, {}))
        for src in order:
            if src not in by_src:
                continue
            val, ts = by_src[src]
            age = now - ts
            if age <= max_age:
                return val, src, age
        for src in order:
            if src not in by_src:
                continue
            val, ts = by_src[src]
            return val, src, now - ts
        return None


class SharedClock:
    """Last NMEA line time, any source / per source. Liveness = sentences."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        now = time.time()
        self.last_any = now
        self.last_line = {gw["id"]: 0.0 for gw in GATEWAYS}
        self.last_error = {gw["id"]: "" for gw in GATEWAYS}

    def mark(self, source: str, ts: float) -> None:
        with self._lock:
            self.last_any = ts
            self.last_line[source] = ts
            self.last_error[source] = ""

    def mark_error(self, source: str, msg: str) -> None:
        with self._lock:
            self.last_error[source] = (msg or "")[:160]

    def snapshot(self) -> tuple[float, dict[str, float], dict[str, str]]:
        with self._lock:
            return self.last_any, dict(self.last_line), dict(self.last_error)


# ---------------------------------------------------------------------------
# MQTT
# ---------------------------------------------------------------------------


def make_mqtt_client():
    import paho.mqtt.client as mqtt

    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD or None)
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    def on_connect(client, userdata, flags, reason_code, properties=None):
        log.info("MQTT connected to %s:%s (reason=%s)", MQTT_HOST, MQTT_PORT, reason_code)

    def on_disconnect(client, userdata, flags, reason_code, properties=None):
        log.warning("MQTT disconnected (reason=%s) -- paho will auto-reconnect", reason_code)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=30)
    client.loop_start()
    return client


def publish_alias(client, suffix: str, value: float | None) -> None:
    if value is None:
        return
    client.publish(f"{MQTT_TOPIC_PREFIX}/{suffix}", f"{value:.2f}", qos=0, retain=False)


def publish_alias_str(client, suffix: str, value: str) -> None:
    client.publish(f"{MQTT_TOPIC_PREFIX}/{suffix}", value, qos=0, retain=False)


# Signal K wants SI. HA keeps `value` in display units. `value_si` is the
# converted number for signalk-mqtt-sensors (unit: literal) — #48.
_KN_MS = 0.514444
_DEG_RAD = math.pi / 180.0
_NM_M = 1852.0


def value_si(path: str, value: float) -> float | None:
    if path in ("wind/aws", "wind/tws", "wind/aws_gust", "wind/tws_gust", "nav/sog", "nav/stw"):
        return value * _KN_MS
    if path in (
        "wind/awa", "wind/twa", "wind/twd",
        "nav/cog", "nav/heading_true", "nav/heading_mag",
        "nav/rudder", "env/pitch", "env/roll", "env/yaw",
    ):
        return value * _DEG_RAD
    if path == "nav/rot":
        return value * _DEG_RAD / 60.0  # deg/min → rad/s
    if path == "nav/log":
        return value * _NM_M
    if path.endswith("/rpm"):
        return value / 60.0  # rpm → Hz
    if path.endswith("/fuel_rate"):
        return value * 1e-3 / 3600.0  # L/h → m³/s
    if path.endswith("/hours"):
        return value * 3600.0
    if path.endswith("/boost"):
        return value * 1e5  # bar → Pa
    return None


def publish_kernel(client, path: str, value: float, source: str, stale_s: float) -> None:
    body: dict = {"value": value, "source": source, "stale_s": round(stale_s, 2)}
    si = value_si(path, value)
    if si is not None:
        body["value_si"] = round(si, 6)
    client.publish(
        f"{MQTT_KERNEL_PREFIX}/{path}",
        json.dumps(body, separators=(",", ":")),
        qos=0,
        retain=False,
    )


# ---------------------------------------------------------------------------
# Persistent NMEA connection (one thread per gateway)
# ---------------------------------------------------------------------------


def connect(gateway: dict) -> socket.socket:
    sock = socket.create_connection((gateway["host"], gateway["port"]), timeout=5)
    sock.settimeout(2.0)
    return sock


def read_lines(sock: socket.socket, buf: bytes) -> tuple[list[str], bytes]:
    """Non-blocking-ish read: one recv() call, split into complete lines."""
    try:
        chunk = sock.recv(4096)
    except socket.timeout:
        return [], buf
    if not chunk:
        raise ConnectionError("gateway closed the connection")
    buf += chunk
    lines = []
    while b"\n" in buf:
        raw, buf = buf.split(b"\n", 1)
        line = raw.decode("ascii", errors="ignore").strip("\r")
        if line.startswith("$") or line.startswith("!"):
            lines.append(line)
    return lines, buf


def gateway_reader(
    gateway: dict,
    store: FieldStore,
    gusts: dict[str, dict[str, GustTracker]],
    clock: SharedClock,
    stop: threading.Event,
) -> None:
    """Stay on one gateway. Mute for CONNECTION_STALE_SECONDS → reconnect it.

    Independent of the other gateway — that is the #45 dual-listen + the #49
    lesson (do not restart the whole process back onto a zombie primary).
    """
    gw_id = gateway["id"]
    backoff = 1.0
    while not stop.is_set():
        sock: socket.socket | None = None
        buf = b""
        conn_data_time = time.time()
        try:
            sock = connect(gateway)
            buf = b""
            conn_data_time = time.time()
            backoff = 1.0
            log.info("connected to %s (%s:%s)", gw_id, gateway["host"], gateway["port"])
            while not stop.is_set():
                now = time.time()
                if now - conn_data_time > CONNECTION_STALE_SECONDS:
                    log.warning(
                        "%s (%s:%s) accepted the connection but produced no data for %.0fs -- "
                        "treating as failed, reconnecting this socket",
                        gw_id, gateway["host"], gateway["port"], now - conn_data_time,
                    )
                    clock.mark_error(gw_id, f"mute {int(now - conn_data_time)}s")
                    break
                try:
                    lines, buf = read_lines(sock, buf)
                except (OSError, ConnectionError) as exc:
                    log.warning("connection to %s lost: %s -- reconnecting", gw_id, exc)
                    clock.mark_error(gw_id, str(exc))
                    break
                if not lines:
                    continue
                now = time.time()
                conn_data_time = now
                clock.mark(gw_id, now)
                for line in lines:
                    parsed = nmea_gateways.parse_nmea([line])
                    if not parsed:
                        continue
                    store.update(gw_id, parsed, now)
                    if "aws_kn" in parsed:
                        gusts[gw_id]["aws"].add(parsed["aws_kn"])
                    if "tws_kn" in parsed:
                        gusts[gw_id]["tws"].add(parsed["tws_kn"])
        except OSError as exc:
            log.warning(
                "connect to %s (%s:%s) failed: %s -- retrying in %.1fs",
                gw_id, gateway["host"], gateway["port"], exc, backoff,
            )
            clock.mark_error(gw_id, str(exc))
        finally:
            if sock is not None:
                try:
                    sock.close()
                except OSError:
                    pass
        if stop.wait(backoff):
            return
        backoff = min(backoff * 2, 10.0)


# ---------------------------------------------------------------------------
# Supervisor watchdog listener (#64)
# ---------------------------------------------------------------------------


def watchdog_listener(port: int, stop: threading.Event) -> None:
    """Accept-and-close on `port` so Supervisor's `watchdog: tcp://[HOST]:port`
    probe (config.yaml) can tell this process is alive. No protocol/content
    needed for a tcp:// probe — a successful connect is the whole check."""
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        srv.bind(("0.0.0.0", port))
        srv.listen(1)
        srv.settimeout(1.0)
    except OSError as exc:
        log.error("watchdog listener could not bind port %s: %s", port, exc)
        return
    log.info("supervisor watchdog listener on tcp://0.0.0.0:%s", port)
    while not stop.is_set():
        try:
            conn, _ = srv.accept()
            conn.close()
        except socket.timeout:
            continue
        except OSError:
            break
    srv.close()


# ---------------------------------------------------------------------------
# Publish loop
# ---------------------------------------------------------------------------


def run() -> None:
    mqtt_client = make_mqtt_client()
    store = FieldStore()
    clock = SharedClock()
    stop = threading.Event()
    gusts = {
        gw["id"]: {
            "aws": GustTracker(GUST_WINDOW_SECONDS),
            "tws": GustTracker(GUST_WINDOW_SECONDS),
        }
        for gw in GATEWAYS
    }

    log.info(
        "starting kernel ingest: ydwg=%s:%s datahub=%s:%s mqtt=%s:%s "
        "kernel=%s alias=%s publish_hz=%s gust_window=%ss field_fresh=%ss "
        "conn_stale=%ss stale_restart=%ss",
        YDWG_HOST, YDWG_PORT, DATAHUB_HOST, DATAHUB_PORT, MQTT_HOST, MQTT_PORT,
        MQTT_KERNEL_PREFIX, MQTT_TOPIC_PREFIX, PUBLISH_HZ, GUST_WINDOW_SECONDS,
        FIELD_FRESH_SECONDS, CONNECTION_STALE_SECONDS, STALE_RESTART_SECONDS,
    )

    threads = [
        threading.Thread(
            target=gateway_reader,
            name=f"nmea-{gw['id']}",
            args=(gw, store, gusts, clock, stop),
            daemon=True,
        )
        for gw in GATEWAYS
    ]
    threads.append(
        threading.Thread(
            target=watchdog_listener,
            name="nmea-watchdog",
            args=(SUPERVISOR_WATCHDOG_PORT, stop),
            daemon=True,
        )
    )
    for t in threads:
        t.start()

    last_publish = 0.0
    try:
        while True:
            now = time.time()
            last_any, last_line, last_error = clock.snapshot()

            # Outer watchdog: nothing from *either* gateway. Dual-listen
            # already keeps each socket reconnecting on its own mute; this
            # is the last resort when both are dead (#49 leftover, still
            # useful if the process itself wedges).
            if now - last_any > STALE_RESTART_SECONDS:
                log.error(
                    "no NMEA data from any gateway for %.0fs "
                    "(> STALE_RESTART_SECONDS=%.0fs) -- exiting for Docker restart",
                    now - last_any, STALE_RESTART_SECONDS,
                )
                stop.set()
                sys.exit(1)

            if now - last_publish >= 1.0 / PUBLISH_HZ:
                last_publish = now
                wind_source = "none"
                picked: dict[str, tuple[float, str, float]] = {}
                for store_key, path, ydwg_only in KERNEL_MAP:
                    hit = store.pick(store_key, now, ydwg_only=ydwg_only)
                    if hit is None:
                        continue
                    val, src, stale = hit
                    picked[store_key] = hit
                    publish_kernel(mqtt_client, path, val, src, stale)
                    if store_key == "aws_kn":
                        # #162: a frozen last value is not a live wind path.
                        wind_source = src if stale <= FIELD_FRESH_SECONDS else "none"

                # Gusts follow the same source as the current speed pick.
                for kind, path in (("aws", "wind/aws_gust"), ("tws", "wind/tws_gust")):
                    speed_key = f"{kind}_kn"
                    if speed_key not in picked:
                        continue
                    _, src, stale = picked[speed_key]
                    g = gusts[src][kind].gust()
                    if g is None:
                        continue
                    publish_kernel(mqtt_client, path, g, src, stale)
                    publish_alias(mqtt_client, f"{kind}_gust", g)

                for alias, store_key in ALIAS_WIND.items():
                    if store_key in picked:
                        publish_alias(mqtt_client, alias, picked[store_key][0])

                # First-class liveness for HA (#50): data flowing, not TCP-open.
                # live = a sentence arrived within CONNECTION_STALE_SECONDS.
                sources_snap: dict[str, dict] = {}
                for src in SOURCE_ORDER:
                    seen = last_line.get(src) or 0.0
                    age = (now - seen) if seen else None
                    live = age is not None and age <= CONNECTION_STALE_SECONDS
                    err = last_error.get(src) or ""
                    sources_snap[src] = {
                        "live": live,
                        "age_s": None if age is None else round(age, 2),
                        "error": err,
                    }
                    mqtt_client.publish(
                        f"{MQTT_KERNEL_PREFIX}/meta/{src}/live",
                        "true" if live else "false",
                        qos=0,
                        retain=False,
                    )
                    if age is not None:
                        mqtt_client.publish(
                            f"{MQTT_KERNEL_PREFIX}/meta/{src}/age_s",
                            f"{age:.2f}",
                            qos=0,
                            retain=False,
                        )
                        publish_kernel(
                            mqtt_client, f"meta/{src}_fresh_age_s", round(age, 2), src, 0.0,
                        )
                    mqtt_client.publish(
                        f"{MQTT_KERNEL_PREFIX}/meta/{src}/error",
                        err,
                        qos=0,
                        retain=False,
                    )
                mqtt_client.publish(
                    f"{MQTT_KERNEL_PREFIX}/meta/sources",
                    json.dumps(sources_snap, separators=(",", ":")),
                    qos=0,
                    retain=False,
                )

                # #49 detection aliases: which source actually fed wind, and
                # seconds since the last genuinely fresh NMEA line (any gw).
                publish_alias_str(mqtt_client, "gateway_active", wind_source)
                last_fresh = last_any
                publish_alias(mqtt_client, "last_fresh_age_s", round(now - last_fresh, 1))

                try:
                    HEARTBEAT_FILE.write_text(str(now))
                except OSError as exc:
                    log.warning("could not write heartbeat file %s: %s", HEARTBEAT_FILE, exc)

            time.sleep(0.05)
    finally:
        stop.set()


if __name__ == "__main__":
    run()
