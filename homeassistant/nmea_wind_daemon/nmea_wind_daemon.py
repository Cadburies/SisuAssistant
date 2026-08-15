#!/usr/bin/env python3
"""Persistent NMEA wind listener — issue #37.

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

True wind direction (twd) comes straight from the instrument's own MWD
sentence, not a heading+AWA approximation computed here -- issue #40, and
the general rule now in CLAUDE.md: check whether the instrument already
transmits a value directly before deriving/computing it ourselves.

Restart safeguards (issue #37 acceptance):
  1. Docker `restart: unless-stopped` on the container (crash / Desktop restart)
  2. Internal reconnect loop with backoff on any socket error (transient network
     blips don't need a full container restart)
  3. Per-connection stale detector -> active failover: if the *current*
     connection hasn't produced a line in CONNECTION_STALE_SECONDS, treat it
     as failed and rotate to the next gateway immediately, in-process (no
     restart). Added 2026-08-15 after finding live that a bare `connect()`
     succeeding is not proof of a healthy gateway -- YDWG-02 was found in a
     state where its TCP port completed the handshake and then reset on the
     first read (NMEA-serving process dead, network stack alive). That
     doesn't raise OSError/ConnectionError, so the old code never advanced
     past YDWG -- confirmed live: 47 consecutive watchdog-restart cycles
     over ~2h, every one retrying YDWG first, never once reaching the
     (perfectly healthy, verified live) DataHub failover, because the old
     STALE_RESTART_SECONDS watchdog did a full *process* restart, which
     resets gateway_idx back to 0 (primary) instead of advancing.
  4. Stall watchdog (STALE_RESTART_SECONDS, outer safety net): if no data
     at all for this long -- i.e. cycling through every gateway via #3
     hasn't found a working one either -- exit(1) so Docker's restart
     policy gets a clean slate. Rarely fires now that #3 handles the
     common single-gateway-hung case in seconds, not minutes.
  5. paho-mqtt's own automatic reconnect (a Mosquitto restart doesn't kill us)
  6. A heartbeat file for Docker's `healthcheck:` -- observable in `docker ps`
     independent of whether the process has merely wedged vs actually died

Detection (the other half of the #37/#40 lesson -- a bare TCP-port-open
check, e.g. binary_sensor.ydwg_online in nmea_gateways.yaml, cannot see the
"port open, data dead" state at all): publishes sisu/nmea/wind/gateway_active
(which gateway is actually in use right now) and /last_fresh_age_s (seconds
since the last genuinely fresh NMEA line, not just since the last MQTT
publish -- the daemon republishes cached values every tick regardless, so
"a fresh-looking published value" is not proof data is actually flowing).

Env vars (all have sane defaults for the Mac interim stack, see
docker-compose.mac.yml / docker-compose.yml for the F8-target values):
  YDWG_HOST, YDWG_PORT       (primary gateway)
  DATAHUB_HOST, DATAHUB_PORT (failover gateway)
  MQTT_HOST, MQTT_PORT
  PUBLISH_HZ                 (default 1.0 -- throttled reporting rate)
  GUST_WINDOW_SECONDS        (default 5.0 -- rolling max window)
  CONNECTION_STALE_SECONDS   (default 15 -- per-connection failover trigger)
  STALE_RESTART_SECONDS      (default 60 -- outer watchdog threshold)
  HEARTBEAT_FILE             (default /tmp/nmea_wind_daemon.heartbeat)
"""
from __future__ import annotations

import collections
import logging
import os
import socket
import sys
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
MQTT_TOPIC_PREFIX = os.environ.get("MQTT_TOPIC_PREFIX", "sisu/nmea/wind")

PUBLISH_HZ = float(os.environ.get("PUBLISH_HZ", "1.0"))
GUST_WINDOW_SECONDS = float(os.environ.get("GUST_WINDOW_SECONDS", "5.0"))
CONNECTION_STALE_SECONDS = float(os.environ.get("CONNECTION_STALE_SECONDS", "15"))
STALE_RESTART_SECONDS = float(os.environ.get("STALE_RESTART_SECONDS", "60"))
HEARTBEAT_FILE = Path(os.environ.get("HEARTBEAT_FILE", "/tmp/nmea_wind_daemon.heartbeat"))

GATEWAYS = [
    {"id": "ydwg", "host": YDWG_HOST, "port": YDWG_PORT},
    {"id": "datahub", "host": DATAHUB_HOST, "port": DATAHUB_PORT},
]
# How often (seconds) to re-check whether the preferred (first) gateway has
# come back, while currently running on a lower-priority failover -- matches
# nmea_gateways.py's "prefer YDWG" policy instead of sticking with DataHub
# forever once YDWG blips.
FAILBACK_CHECK_SECONDS = 30.0


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
# MQTT
# ---------------------------------------------------------------------------


def make_mqtt_client():
    import paho.mqtt.client as mqtt

    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
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


def publish(client, suffix: str, value: float | None) -> None:
    if value is None:
        return
    client.publish(f"{MQTT_TOPIC_PREFIX}/{suffix}", f"{value:.2f}", qos=0, retain=False)


def client_publish_str(client, suffix: str, value: str) -> None:
    client.publish(f"{MQTT_TOPIC_PREFIX}/{suffix}", value, qos=0, retain=False)


# ---------------------------------------------------------------------------
# Persistent NMEA connection
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


def run() -> None:
    mqtt_client = make_mqtt_client()

    aws = GustTracker(GUST_WINDOW_SECONDS)
    tws = GustTracker(GUST_WINDOW_SECONDS)
    awa_current: float | None = None
    twa_current: float | None = None  # true wind angle, MWV reference T -- the AWA equivalent
    # True wind direction -- sourced from the instrument's own MWD sentence
    # (heading_true + true wind angle, computed on the instrument, confirmed
    # internally consistent live 2026-08-15 -- see data_flow.md), NOT derived
    # here from heading+AWA. Rule: check whether the instrument already
    # transmits a value before computing/approximating it ourselves
    # (CLAUDE.md mandatory rules).
    twd_current: float | None = None

    gateway_idx = 0
    last_failback_check = 0.0
    last_publish = 0.0
    last_data_time = time.time()      # outer watchdog: any gateway, any time
    conn_data_time = time.time()      # per-connection: resets on every (re)connect
    last_fresh_time = time.time()     # last genuinely fresh NMEA line parsed -- published for detection

    sock: socket.socket | None = None
    buf = b""

    log.info(
        "starting: primary=%s:%s failover=%s:%s mqtt=%s:%s publish_hz=%s gust_window=%ss "
        "conn_stale=%ss stale_restart=%ss",
        YDWG_HOST, YDWG_PORT, DATAHUB_HOST, DATAHUB_PORT, MQTT_HOST, MQTT_PORT,
        PUBLISH_HZ, GUST_WINDOW_SECONDS, CONNECTION_STALE_SECONDS, STALE_RESTART_SECONDS,
    )

    backoff = 1.0
    while True:
        now = time.time()

        # Outer watchdog: nothing from *any* gateway for a long time, i.e.
        # rotating through every gateway (below) hasn't found a working one
        # either. Full process restart as a last resort.
        if now - last_data_time > STALE_RESTART_SECONDS:
            log.error(
                "no NMEA data from any gateway for %.0fs (> STALE_RESTART_SECONDS=%.0fs) -- exiting for Docker restart",
                now - last_data_time, STALE_RESTART_SECONDS,
            )
            sys.exit(1)

        # Per-connection stale detector: the *current* gateway hasn't produced
        # a line in CONNECTION_STALE_SECONDS. A successful connect() is not
        # proof of a healthy gateway -- confirmed live 2026-08-15, YDWG-02's
        # TCP port completed handshakes fine while its NMEA-serving process
        # was dead. Rotate to the next gateway immediately, in-process --
        # this is the actual failover path now, not the outer watchdog.
        if sock is not None and now - conn_data_time > CONNECTION_STALE_SECONDS:
            gw = GATEWAYS[gateway_idx]
            log.warning(
                "%s (%s:%s) accepted the connection but produced no data for %.0fs -- "
                "treating as failed, rotating to next gateway",
                gw["id"], gw["host"], gw["port"], now - conn_data_time,
            )
            try:
                sock.close()
            except OSError:
                pass
            sock = None
            gateway_idx = (gateway_idx + 1) % len(GATEWAYS)
            # Reset the failback timer *here*, not just on a successful
            # connect below -- without this, last_failback_check is still
            # whatever it was (0.0 at startup, or long ago), so the failback
            # check a few lines down fires on literally the next loop tick
            # and immediately flips back to the gateway we just proved was
            # bad, using the same shallow tcp_open() check that couldn't see
            # the problem in the first place. Confirmed live in an isolated
            # test 2026-08-15: without this line, a zombie gateway (accepts
            # connections, sends nothing) gets rotated away from and flipped
            # right back to in the same log timestamp -- a tight flap loop
            # hiding behind a "rotating to next gateway" log line that looks
            # like it worked. With this reset, the failover gateway gets a
            # real FAILBACK_CHECK_SECONDS of uninterrupted service before
            # we'll even consider trying the primary again.
            last_failback_check = time.time()

        if sock is None:
            gw = GATEWAYS[gateway_idx]
            try:
                sock = connect(gw)
                buf = b""
                conn_data_time = time.time()
                backoff = 1.0
                log.info("connected to %s (%s:%s)", gw["id"], gw["host"], gw["port"])
            except OSError as exc:
                log.warning("connect to %s (%s:%s) failed: %s -- retrying in %.1fs",
                            gw["id"], gw["host"], gw["port"], exc, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, 10.0)
                gateway_idx = (gateway_idx + 1) % len(GATEWAYS)
                last_failback_check = time.time()  # same reset, see above
                continue

        # Periodically try to fail back to the preferred (first) gateway if
        # we're currently running on a lower-priority one. Uses the same
        # bare tcp_open() check that proved insufficient for *detecting* a
        # hang above -- fine here, since a real failure to actually deliver
        # data after failing back gets caught by the stale-connection check
        # on the next cycle, same as any other gateway (worst case: a brief
        # ~CONNECTION_STALE_SECONDS interruption every ~FAILBACK_CHECK_SECONDS
        # while a hung primary is being retried, not a tight flap loop).
        if gateway_idx != 0 and now - last_failback_check > FAILBACK_CHECK_SECONDS:
            last_failback_check = now
            if nmea_gateways.tcp_open(GATEWAYS[0]["host"], GATEWAYS[0]["port"]):
                log.info("preferred gateway %s back online -- switching back", GATEWAYS[0]["id"])
                sock.close()
                sock = None
                gateway_idx = 0
                continue

        try:
            lines, buf = read_lines(sock, buf)
        except (OSError, ConnectionError) as exc:
            log.warning("connection to gateway lost: %s -- reconnecting", exc)
            try:
                sock.close()
            except OSError:
                pass
            sock = None
            continue

        if lines:
            now = time.time()
            last_data_time = now
            conn_data_time = now
            last_fresh_time = now
            # Parse one line at a time, not the whole batch at once -- a
            # single recv() can occasionally catch two MWV cycles in one
            # chunk, and parse_nmea() dict-overwrites same-key fields across
            # a batch (last-in-batch wins). Line-by-line means every reading
            # that arrives gets fed to the gust tracker, not just the last
            # one in whatever chunk TCP happened to hand us -- the whole
            # point of this daemon vs the old poll model.
            for line in lines:
                parsed = nmea_gateways.parse_nmea([line])
                if "aws_kn" in parsed:
                    aws.add(parsed["aws_kn"])
                if "tws_kn" in parsed:
                    tws.add(parsed["tws_kn"])
                if "awa_deg" in parsed:
                    awa_current = parsed["awa_deg"]
                if "twa_deg" in parsed:
                    twa_current = parsed["twa_deg"]
                if "twd_true_deg" in parsed:
                    twd_current = parsed["twd_true_deg"]

        if now - last_publish >= 1.0 / PUBLISH_HZ:
            last_publish = now
            publish(mqtt_client, "aws", aws.current)
            publish(mqtt_client, "aws_gust", aws.gust())
            publish(mqtt_client, "tws", tws.current)
            publish(mqtt_client, "tws_gust", tws.gust())
            publish(mqtt_client, "awa", awa_current)
            publish(mqtt_client, "twa", twa_current)
            publish(mqtt_client, "twd", twd_current)
            client_publish_str(mqtt_client, "gateway_active", GATEWAYS[gateway_idx]["id"])
            publish(mqtt_client, "last_fresh_age_s", round(now - last_fresh_time, 1))
            try:
                HEARTBEAT_FILE.write_text(str(now))
            except OSError as exc:
                log.warning("could not write heartbeat file %s: %s", HEARTBEAT_FILE, exc)


if __name__ == "__main__":
    run()
