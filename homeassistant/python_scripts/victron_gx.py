#!/usr/bin/env python3
"""Victron Color Control (Venus OS GX device) -> HA, direct MQTT.

Independent of Claude2's Signal K Victron work (issue #18 thread) --
this polls the GX device's own MQTT-on-LAN directly rather than going
through Signal K, so it doesn't depend on that integration landing
first. Two consumers of the same source data is fine; they're separate
paths (HA direct vs Signal K/KIP), not a conflict.

Protocol: same Victron-VenusOS convention already reverse-engineered
for issue #18 -- subscribe to N/<portalID>/#, then publish an empty
payload to R/<portalID>/system/0/Serial to trigger a full broadcast.
Devices confirmed present on this vessel's GX (2026-08-09): BMV-702
battery monitor (battery/256), MultiPlus 12/3000/120-50 (vebus/257),
2x BlueSolar MPPT 150/60 + 1x SmartSolar MPPT VE.Can 250/100
(solarcharger/288,290,291). No cell-level BMS (Lynx Smart BMS) present
-- cell min/max voltage genuinely has no data source here, left
unavailable rather than fabricated.

Usage:
  victron_gx.py data     # JSON for the HA command_line sensor (default)
  victron_gx.py health   # reachability only

Secrets (homeassistant/secrets.yaml or /config/secrets.yaml):
  ColorControlIP (default 192.168.10.32)
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None

_SECRET_CANDIDATES = (
    Path(__file__).resolve().parent.parent / "secrets.yaml",
    Path("/config/secrets.yaml"),
    Path("/homeassistant/secrets.yaml"),
)


def _load_secrets() -> dict[str, str]:
    out: dict[str, str] = {}
    for p in _SECRET_CANDIDATES:
        if not p.is_file():
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for line in text.splitlines():
            m = re.match(r'^([A-Za-z0-9_]+):\s*["\']?([^"\'#\n]*?)["\']?\s*(?:#.*)?$', line)
            if not m:
                continue
            k, v = m.group(1), m.group(2).strip()
            if v:
                out[k] = v
        if out:
            break
    return out


def _cfg() -> dict[str, str]:
    s = _load_secrets()
    return {
        "host": os.environ.get("COLOR_CONTROL_IP") or s.get("ColorControlIP") or "192.168.10.32",
        "port": os.environ.get("COLOR_CONTROL_MQTT_PORT") or "1883",
    }


def _collect(host: str, port: int, wait_s: float = 10.0) -> dict[str, Any]:
    """Connect, subscribe, keepalive, collect N/<portal>/# topics for wait_s."""
    topics: dict[str, Any] = {}
    portal_id: dict[str, str | None] = {"id": None}

    def on_connect(client, userdata, flags, rc, properties=None):
        client.subscribe("N/#", qos=0)

    def on_message(client, userdata, msg):
        # Normalize "N/<portalID>/<rest>" -> "<rest>" so lookups below can
        # use bare Venus OS paths (solarcharger/288/..., vebus/257/..., etc.)
        # regardless of which portal ID this GX device happens to have.
        parts = msg.topic.split("/", 2)
        bare_topic = parts[2] if len(parts) == 3 and parts[0] == "N" else msg.topic
        try:
            payload = json.loads(msg.payload.decode(errors="replace"))
            topics[bare_topic] = payload.get("value")
        except (ValueError, AttributeError):
            pass
        if portal_id["id"] is None and len(parts) == 3 and parts[0] == "N" and parts[2] == "system/0/Serial":
            portal_id["id"] = parts[1]

    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(host, port, keepalive=30)
    client.loop_start()

    # Portal ID arrives within the first ~1s of any connection.
    deadline = time.time() + min(2.0, wait_s)
    while portal_id["id"] is None and time.time() < deadline:
        time.sleep(0.1)

    if portal_id["id"]:
        client.publish(f"R/{portal_id['id']}/system/0/Serial", "", qos=0)

    remaining = deadline_full = time.time() + wait_s
    while time.time() < remaining:
        time.sleep(0.1)

    client.loop_stop()
    client.disconnect()
    return topics


def _num(topics: dict[str, Any], key: str) -> float | None:
    v = topics.get(key)
    return v if isinstance(v, (int, float)) else None


# Victron MPPT charger "State" enum (subset, documented values).
_MPPT_STATE = {0: "off", 2: "fault", 3: "bulk", 4: "absorption", 5: "float", 7: "equalize", 245: "starting"}


def health() -> dict[str, Any]:
    cfg = _cfg()
    if mqtt is None:
        return {"host": cfg["host"], "paho_available": False}
    try:
        topics = _collect(cfg["host"], int(cfg["port"]), wait_s=2.0)
        return {"host": cfg["host"], "paho_available": True, "reachable": len(topics) > 0}
    except OSError:
        return {"host": cfg["host"], "paho_available": True, "reachable": False}


def data() -> dict[str, Any]:
    cfg = _cfg()
    if mqtt is None:
        return {"online": False, "error": "paho-mqtt not available"}
    try:
        t = _collect(cfg["host"], int(cfg["port"]))
    except OSError:
        return {"online": False}

    if not t:
        return {"online": False}

    out: dict[str, Any] = {"online": True}

    # ---- Battery / BMS (BMV-702 -- see file header for what's NOT present) ----
    # Deliberately battery/256 (BMV-702 shunt on the whole bank), not
    # system/0/Dc/Battery/* -- issue #27 found the two don't reconcile
    # (e.g. +110A vs -9A at the same moment). system/0 traces to
    # ActiveBatteryService=vebus/257, i.e. the MultiPlus's own DC port
    # current, not the whole-bank net -- the small negative reading there
    # is just the inverter's own local draw powering AC loads, present at
    # the same time the whole bank is net strongly charging. battery/256
    # is the authoritative whole-bank reading and what "the BMS says".
    batt_prefix = None
    for k in t:
        if k.startswith("battery/") and k.endswith("/Soc"):
            batt_prefix = k.rsplit("/Soc", 1)[0]
            break
    if batt_prefix:
        soc = _num(t, f"{batt_prefix}/Soc")
        out["battery_soc"] = round(soc, 1) if soc is not None else None
        v = _num(t, f"{batt_prefix}/Dc/0/Voltage")
        # 2 decimals: matches the ESPHome house_v convention (marine_alternator.yaml,
        # waterlevels.yaml) -- 0.01 V resolution is what BMS charge-stage
        # thresholds (absorption/float/charged) are actually compared against.
        out["battery_voltage"] = round(v, 2) if v is not None else None
        i = _num(t, f"{batt_prefix}/Dc/0/Current")
        out["battery_current"] = round(i, 1) if i is not None else None
        p = _num(t, f"{batt_prefix}/Dc/0/Power")
        out["battery_power"] = round(p, 0) if p is not None else None
        consumed = _num(t, f"{batt_prefix}/ConsumedAmphours")
        out["battery_consumed_ah"] = abs(consumed) if consumed is not None else None
        ttg = _num(t, f"{batt_prefix}/TimeToGo")
        out["battery_time_to_go_h"] = round(ttg / 3600, 1) if ttg else None
        cur = out["battery_current"]
        out["bms_state"] = (
            "charging" if cur and cur > 1.0 else
            "discharging" if cur and cur < -1.0 else
            "idle" if cur is not None else "unknown"
        )
        alarm_keys = [k for k in t if k.startswith(f"{batt_prefix}/Alarms/")]
        active_alarms = [k.rsplit("/", 1)[-1] for k in alarm_keys if _num(t, k) not in (None, 0)]
        out["bms_alarm_active"] = len(active_alarms) > 0
        out["bms_alarm_names"] = ", ".join(active_alarms) if active_alarms else "none"
    else:
        out["battery_soc"] = None

    # ---- Solar (per MPPT + sum). Live 2026-08-15 (#54):
    #   288 ROOF FWD SOLAR  BlueSolar 150/60
    #   290 ROOF MID SOLAR  BlueSolar 150/60
    #   291 AFT SOLAR       SmartSolar VE.Can 250/100
    # Daily yield is History/Daily/0/Yield (kWh, instrument clock) — not VRM.
    charger_instances = sorted({k.split("/")[1] for k in t if k.startswith("solarcharger/")})
    solar_total = 0.0
    solar_seen = False
    yield_total = 0.0
    yield_seen = False
    states = []
    chargers: list[dict[str, Any]] = []
    for inst in charger_instances:
        p = _num(t, f"solarcharger/{inst}/Yield/Power")
        if p is not None:
            solar_total += p
            solar_seen = True
        y = _num(t, f"solarcharger/{inst}/History/Daily/0/Yield")
        if y is not None:
            yield_total += y
            yield_seen = True
        pv = _num(t, f"solarcharger/{inst}/Pv/V")
        st = t.get(f"solarcharger/{inst}/State")
        state = None
        if isinstance(st, (int, float)):
            state = _MPPT_STATE.get(int(st), f"code{int(st)}")
            states.append(state)
        name = t.get(f"solarcharger/{inst}/CustomName") or t.get(
            f"solarcharger/{inst}/ProductName"
        ) or f"MPPT {inst}"
        chargers.append({
            "instance": inst,
            "name": str(name),
            "power_w": round(p, 1) if p is not None else None,
            "yield_today_kwh": round(y, 2) if y is not None else None,
            "pv_v": round(pv, 1) if pv is not None else None,
            "state": state,
        })
        nu = str(name).upper()
        if "FWD" in nu:
            slug = "roof_fwd"
        elif "MID" in nu:
            slug = "roof_mid"
        elif "AFT" in nu:
            slug = "aft"
        else:
            slug = f"mppt_{inst}"
        out[f"solar_{slug}_power_w"] = round(p, 1) if p is not None else None
        out[f"solar_{slug}_yield_today_kwh"] = round(y, 2) if y is not None else None
        out[f"solar_{slug}_pv_v"] = round(pv, 1) if pv is not None else None
        out[f"solar_{slug}_state"] = state
    out["solar_power_w"] = round(solar_total, 1) if solar_seen else None
    out["solar_yield_today_kwh"] = round(yield_total, 2) if yield_seen else None
    out["solar_charger_count"] = len(charger_instances)
    out["solar_chargers"] = chargers
    out["solar_state"] = ", ".join(sorted(set(states))) if states else "unknown"

    # ---- AC (inverter/charger + system consumption) ----
    out["inverter_power_w"] = _num(t, "vebus/257/Ac/Out/P")
    out["shore_connected"] = bool(_num(t, "system/0/Ac/In/0/Connected"))
    out["ac_loads_w"] = _num(t, "system/0/Ac/Consumption/L1/Power")
    out["dc_loads_w"] = _num(t, "system/0/Dc/System/Power")
    out["grid_power_w"] = _num(t, "system/0/Ac/ActiveIn/L1/Power") if out["shore_connected"] else 0.0

    return out


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "data"
    if cmd == "health":
        print(json.dumps(health()))
    else:
        print(json.dumps(data()))


if __name__ == "__main__":
    main()
