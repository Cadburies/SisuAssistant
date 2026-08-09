#!/usr/bin/env python3
"""Signal K → engine (propulsion) data for HA, Port + Starboard.

Source: YDEG-04 x2 (Yanmar) -> SeaTalkNG -> YDWG-02 -> Signal K
(propulsion.{port,starboard}.*, electrical.batteries.{0,1}.voltage,
notifications.propulsion.{port,starboard}.*). See issue #25,
.ai_context/data_flow.md.

Signal K's REST API requires auth on this instance (401 on anonymous
GET) -- logs in fresh on every invocation rather than caching a token
(Signal K issued a non-expiring token when tested, but re-authenticating
per call is simpler and avoids a stale-token failure mode for a
dashboard-refresh-rate poll).

Usage:
  signalk_engines.py data     # JSON for the HA command_line sensor (default)
  signalk_engines.py health   # reachability + auth check only
  signalk_engines.py raw      # full raw propulsion tree, for debugging

Secrets (homeassistant/secrets.yaml or /config/secrets.yaml):
  signalk_host (default 192.168.0.151 -- interim Mac; repoint to F8 when
    #6 lands, same as mqtt_broker/OPS.md §7)
  SignalKUser / SignalKPwd
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

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
        "host": os.environ.get("SIGNALK_HOST") or s.get("signalk_host") or "192.168.0.151",
        "port": os.environ.get("SIGNALK_PORT") or s.get("signalk_port") or "3000",
        "user": os.environ.get("SIGNALK_USER") or s.get("SignalKUser") or "",
        "pwd": os.environ.get("SIGNALK_PWD") or s.get("SignalKPwd") or "",
    }


def _http_json(url: str, *, method: str = "GET", data: dict | None = None,
                headers: dict | None = None, timeout: float = 6.0) -> Any:
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method,
                                  headers={"Content-Type": "application/json", **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _login(cfg: dict[str, str]) -> str | None:
    if not cfg["user"] or not cfg["pwd"]:
        return None
    url = f"http://{cfg['host']}:{cfg['port']}/signalk/v1/auth/login"
    try:
        resp = _http_json(url, method="POST", data={"username": cfg["user"], "password": cfg["pwd"]})
        return resp.get("token")
    except (urllib.error.URLError, OSError, ValueError):
        return None


def _get(cfg: dict[str, str], token: str | None, path: str) -> Any:
    url = f"http://{cfg['host']}:{cfg['port']}/signalk/v1/api/vessels/self/{path}"
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return _http_json(url, headers=headers)


def _val(node: dict | None) -> float | None:
    if not isinstance(node, dict):
        return None
    v = node.get("value")
    return v if isinstance(v, (int, float)) else None


def health() -> dict[str, Any]:
    cfg = _cfg()
    token = _login(cfg)
    ok = token is not None
    return {"host": cfg["host"], "port": cfg["port"], "authenticated": ok}


def raw() -> Any:
    cfg = _cfg()
    token = _login(cfg)
    return _get(cfg, token, "propulsion")


def data() -> dict[str, Any]:
    cfg = _cfg()
    token = _login(cfg)
    if token is None:
        return {"online": False}

    try:
        prop = _get(cfg, token, "propulsion")
    except (urllib.error.URLError, OSError, ValueError):
        return {"online": False}

    try:
        batt = _get(cfg, token, "electrical/batteries")
    except (urllib.error.URLError, OSError, ValueError):
        batt = {}

    try:
        notif = _get(cfg, token, "notifications/propulsion")
    except (urllib.error.URLError, OSError, ValueError):
        notif = {}

    out: dict[str, Any] = {"online": True}

    # engine side -> (SK propulsion key, SK battery instance)
    sides = {"port": "0", "starboard": "1"}

    for side, batt_inst in sides.items():
        eng = prop.get(side, {}) if isinstance(prop, dict) else {}

        rev_hz = _val(eng.get("revolutions"))
        out[f"{side}_rpm"] = round(rev_hz * 60, 0) if rev_hz is not None else None

        temp_k = _val(eng.get("temperature"))
        out[f"{side}_coolant_c"] = round(temp_k - 273.15, 1) if temp_k is not None else None

        oil_pa = _val(eng.get("oilPressure"))
        out[f"{side}_oil_bar"] = round(oil_pa / 100000, 2) if oil_pa is not None else None

        out[f"{side}_alt_v"] = _val(eng.get("alternatorVoltage"))

        fuel_m3s = _val(eng.get("fuel", {}).get("rate") if isinstance(eng.get("fuel"), dict) else None)
        out[f"{side}_fuel_lph"] = round(fuel_m3s * 3_600_000, 1) if fuel_m3s is not None else None

        load = _val(eng.get("engineLoad"))
        out[f"{side}_load_pct"] = round(load * 100, 0) if load is not None else None

        boost_pa = _val(eng.get("boostPressure"))
        out[f"{side}_boost_mbar"] = round(boost_pa / 100, 0) if boost_pa is not None else None

        runtime_s = _val(eng.get("runTime"))
        out[f"{side}_hours"] = round(runtime_s / 3600, 1) if runtime_s is not None else None

        bnode = batt.get(batt_inst, {}) if isinstance(batt, dict) else {}
        out[f"{side}_starter_v"] = _val(bnode.get("voltage"))

        # Alarm summary: count + names of anything not in "normal" state.
        side_notif = notif.get(side, {}) if isinstance(notif, dict) else {}
        active = [k for k, v in side_notif.items()
                  if isinstance(v, dict) and v.get("state") not in (None, "normal")]
        out[f"{side}_alarm_count"] = len(active)
        out[f"{side}_alarm_names"] = ", ".join(active) if active else "none"

    return out


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "data"
    if cmd == "health":
        print(json.dumps(health()))
    elif cmd == "raw":
        print(json.dumps(raw()))
    else:
        print(json.dumps(data()))


if __name__ == "__main__":
    main()
