#!/usr/bin/env python3
"""NMEA 2000 gateways → NMEA 0183 over TCP (YDWG primary, DataHub failover).

Sources (LAN, typically Sisu-IoT):
  • Yacht Devices YDWG-02 — TCP NMEA 0183 (default port 1456)
  • PredictWind DataHub   — TCP NMEA 0183 (default port 11102)

Policy:
  Prefer YDWG when its TCP port accepts connections; else DataHub; else none.
  Web admin credentials (YDWG_*/PREDICTWIND_HUB_*) are for UI only — NMEA TCP
  streams are unauthenticated on both products.

Usage:
  nmea_gateways.py health          # JSON: both hosts + active choice
  nmea_gateways.py status          # health + short NMEA sample + parsed fields
  nmea_gateways.py sample [sec]    # raw sentences for debug (default 3s)

Secrets (homeassistant/secrets.yaml or /config/secrets.yaml):
  YDWG_URL / PREDICTWIND_HUB_LOCAL_URL  (host extracted)
  optional: ydwg_nmea_port (1456), datahub_nmea_port (11102)
"""
from __future__ import annotations

import json
import math
import os
import re
import socket
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Secrets / hosts
# ---------------------------------------------------------------------------

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


def _host_from_url(url: str | None, fallback: str) -> str:
    if not url:
        return fallback
    raw = url if "://" in url else f"http://{url}"
    u = urlparse(raw)
    return u.hostname or fallback


def _cfg() -> dict[str, Any]:
    s = _load_secrets()
    ydwg_host = os.environ.get("YDWG_HOST") or _host_from_url(
        s.get("YDWG_URL"), "192.168.10.30"
    )
    dh_host = os.environ.get("DATAHUB_HOST") or _host_from_url(
        s.get("PREDICTWIND_HUB_LOCAL_URL"), "192.168.10.31"
    )
    ydwg_port = int(
        os.environ.get("YDWG_NMEA_PORT")
        or s.get("ydwg_nmea_port")
        or "1456"
    )
    dh_port = int(
        os.environ.get("DATAHUB_NMEA_PORT")
        or s.get("datahub_nmea_port")
        or "11102"
    )
    return {
        "ydwg": {
            "id": "ydwg",
            "name": "Yacht Devices YDWG-02",
            "host": ydwg_host,
            "port": ydwg_port,
            "priority": 1,
        },
        "datahub": {
            "id": "datahub",
            "name": "PredictWind DataHub",
            "host": dh_host,
            "port": dh_port,
            "priority": 2,
        },
    }


# ---------------------------------------------------------------------------
# TCP health + NMEA sample
# ---------------------------------------------------------------------------

def tcp_open(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def nmea_sample(host: str, port: int, seconds: float = 2.5, timeout: float = 2.0) -> list[str]:
    """Read NMEA 0183 lines for up to `seconds` (max ~80 lines)."""
    lines: list[str] = []
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
    except OSError:
        return lines
    sock.settimeout(0.4)
    deadline = time.time() + seconds
    buf = b""
    try:
        while time.time() < deadline and len(lines) < 80:
            try:
                chunk = sock.recv(4096)
            except socket.timeout:
                continue
            if not chunk:
                break
            buf += chunk
            while b"\n" in buf:
                raw, buf = buf.split(b"\n", 1)
                line = raw.decode("ascii", errors="ignore").strip("\r")
                if line.startswith("$") or line.startswith("!"):
                    lines.append(line)
    finally:
        try:
            sock.close()
        except OSError:
            pass
    return lines


# ---------------------------------------------------------------------------
# Parse common sentences (N2K→0183 from gateways)
# ---------------------------------------------------------------------------

def _nmea_field(line: str, idx: int) -> str:
    # strip checksum
    body = line[1:].split("*", 1)[0]
    parts = body.split(",")
    return parts[idx] if idx < len(parts) else ""


def _nmea_fields(line: str) -> list[str]:
    return line[1:].split("*", 1)[0].split(",")


def _float_or_none(s: str) -> float | None:
    if not s:
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    if v != v:  # NaN
        return None
    return v


def _bearing_deg(val: float | None) -> float | None:
    """Compass bearing. Reject values outside [0, 360] (DataHub $IIMWD often >360)."""
    if val is None:
        return None
    if val < 0.0 or val > 360.0:
        return None
    return round(val % 360.0, 1)


def _wrap_deg(val: float | None) -> float | None:
    """Relative angle → [0, 360). Signed TWA (DataHub) becomes the YDWG wrap."""
    if val is None:
        return None
    return round(val % 360.0, 1)


_ENGINE_XDR = re.compile(
    r"^(EngineHours|EngineBoost|Boost|Engine|Fuel|Alternator)#(\d+)$",
    re.IGNORECASE,
)


def _apply_xdr(line: str, out: dict[str, Any]) -> None:
    """NMEA XDR: repeating (type, value, units, name) groups.

    Live 2026-08-15 YDWG / DataHub shapes this actually has to handle:
      $YDXDR,C,34.3,C,Air,P,101210,P,Baro
      $YDXDR,A,63.75,D,Yaw,A,1.00,D,Pitch,A,5.25,D,Roll
      $YDXDR,C,76.0,C,Engine#0,R,0.00038,l,Fuel#0,U,13.3,V,Alternator#0
      $YDXDR,G,3744.10,,EngineHours#0,P,0,P,EngineBoost#0
      $IIXDR,P,101200.0,P,Baro,...,P,1.0120,B,Barometer
      $IIXDR,A,1.1,D,PTCH,A,4.9,D,ROLL
      $DHXDR,X,2.28,rad,HDT,...,X,2.35,rad,MWD   # radians; MWD is sane TWD
    """
    parts = _nmea_fields(line)
    i = 1
    while i + 3 < len(parts):
        typ, val_s, unit, name = parts[i], parts[i + 1], parts[i + 2], parts[i + 3]
        i += 4
        val = _float_or_none(val_s)
        if val is None or not name:
            continue
        unit_l = unit.strip()
        name_l = name.strip()
        name_u = name_l.upper()

        if name_u in ("AIR", "ENV_AIR_T", "AIRTEMP") and typ.upper() == "C":
            out["air_temp_c"] = round(val, 1)
        elif name_u in ("BARO", "ENV_ATMOS_P", "BAROMETER"):
            if unit_l == "P":
                out["baro_hpa"] = round(val / 100.0, 1)
            elif unit_l == "B":
                out["baro_hpa"] = round(val * 1000.0, 1)
        elif name_u == "YAW":
            out["yaw_deg"] = round(val, 2)
        elif name_u in ("PITCH", "PTCH"):
            out["pitch_deg"] = round(val, 2)
        elif name_u in ("ROLL",):
            out["roll_deg"] = round(val, 2)
        elif name_u == "ENV_WATER_T" and typ.upper() == "C":
            out["water_temp_c"] = round(val, 1)
        elif name_u == "HDT" and unit_l.lower() == "rad":
            brg = _bearing_deg(math.degrees(val) % 360.0)
            if brg is not None:
                out.setdefault("heading_true_deg", brg)
        elif name_u == "HDM" and unit_l.lower() == "rad":
            brg = _bearing_deg(math.degrees(val) % 360.0)
            if brg is not None:
                out.setdefault("heading_mag_deg", brg)
        elif name_u == "MWD" and unit_l.lower() == "rad":
            # DataHub $IIMWD is often >360; this rad field is the usable TWD.
            brg = _bearing_deg(math.degrees(val) % 360.0)
            if brg is not None and "twd_true_deg" not in out:
                out["twd_true_deg"] = brg
        else:
            em = _ENGINE_XDR.match(name_l)
            if not em:
                continue
            kind, inst = em.group(1).lower(), em.group(2)
            if kind == "engine":
                if typ.upper() == "C":
                    out[f"engine_{inst}_coolant_c"] = round(val, 1)
            elif kind == "fuel":
                # YDWG sends litres/sec (unit "l"); publish L/h for display.
                if unit_l.lower() == "l":
                    out[f"engine_{inst}_fuel_lph"] = round(val * 3600.0, 3)
            elif kind == "alternator":
                out[f"engine_{inst}_alt_v"] = round(val, 2)
            elif kind == "enginehours":
                out[f"engine_{inst}_hours"] = round(val, 2)
            elif kind in ("engineboost", "boost"):
                if unit_l == "P":
                    out[f"engine_{inst}_boost_bar"] = round(val / 1e5, 3)
                elif unit_l == "B":
                    out[f"engine_{inst}_boost_bar"] = round(val, 3)


def _latlon(dm: str, hemi: str) -> float | None:
    if not dm or not hemi:
        return None
    try:
        # DDMM.MMMM or DDDMM.MMMM
        if len(dm) < 4:
            return None
        # find decimal
        dot = dm.find(".")
        if dot < 0:
            return None
        # minutes always last 2 digits before decimal of integer part
        intpart = dm[:dot]
        if len(intpart) < 3:
            return None
        deg = int(intpart[:-2])
        minutes = float(intpart[-2:] + dm[dot:])
        val = deg + minutes / 60.0
        if hemi in ("S", "W"):
            val = -val
        return val
    except (ValueError, IndexError):
        return None


def parse_nmea(lines: list[str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for line in lines:
        if len(line) < 6 or line[0] not in "$!":
            continue
        talker_type = line[1:6] if len(line) > 6 else ""
        # RMC — recommended minimum
        if talker_type.endswith("RMC") or ",RMC," in line[:10]:
            # $--RMC,time,status,lat,N,lon,E,sog,cog,...
            status = _nmea_field(line, 2)
            lat = _latlon(_nmea_field(line, 3), _nmea_field(line, 4))
            lon = _latlon(_nmea_field(line, 5), _nmea_field(line, 6))
            try:
                sog = float(_nmea_field(line, 7) or "nan")
            except ValueError:
                sog = None
            try:
                cog = float(_nmea_field(line, 8) or "nan")
            except ValueError:
                cog = None
            if status == "A":
                if lat is not None:
                    out["latitude"] = round(lat, 6)
                if lon is not None:
                    out["longitude"] = round(lon, 6)
                if sog is not None and sog == sog:
                    out["sog_kn"] = round(sog, 2)
                    out["sog_ms"] = round(sog * 0.514444, 3)
                if cog is not None and cog == cog:
                    out["cog_deg"] = round(cog, 1)
            out["gps_fix"] = status == "A"
        # VTG — course over ground / speed
        elif talker_type.endswith("VTG") or ",VTG," in line[:10]:
            try:
                cog = float(_nmea_field(line, 1) or "nan")
                if cog == cog:
                    out["cog_deg"] = round(cog, 1)
            except ValueError:
                pass
            # field 5 = knots (N), field 7 = km/h
            try:
                sog = float(_nmea_field(line, 5) or "nan")
                if sog == sog:
                    out["sog_kn"] = round(sog, 2)
                    out["sog_ms"] = round(sog * 0.514444, 3)
            except ValueError:
                pass
        # MWV — wind speed and angle
        elif talker_type.endswith("MWV") or ",MWV," in line[:10]:
            try:
                ang = float(_nmea_field(line, 1) or "nan")
                ref = _nmea_field(line, 2)  # R relative / T true
                spd = float(_nmea_field(line, 3) or "nan")
                unit = _nmea_field(line, 4)  # N kn, M m/s, K km/h
                if ang == ang:
                    wrapped = _wrap_deg(ang)
                    if wrapped is not None:
                        key = "awa_deg" if ref == "R" else "twa_deg"
                        out[key] = wrapped
                if spd == spd:
                    if unit == "N":
                        ms = spd * 0.514444
                    elif unit == "K":
                        ms = spd / 3.6
                    else:
                        ms = spd
                    key = "aws_ms" if ref == "R" else "tws_ms"
                    out[key] = round(ms, 2)
                    out[key.replace("_ms", "_kn")] = round(ms / 0.514444, 2)
            except ValueError:
                pass
        # DPT — depth
        elif talker_type.endswith("DPT") or ",DPT," in line[:10]:
            try:
                d = float(_nmea_field(line, 1) or "nan")
                if d == d:
                    out["depth_m"] = round(d, 2)
            except ValueError:
                pass
        # DBT — depth below transducer (feet, meters, fathoms)
        elif talker_type.endswith("DBT") or ",DBT," in line[:10]:
            try:
                d = float(_nmea_field(line, 3) or "nan")  # meters field
                if d == d:
                    out["depth_m"] = round(d, 2)
            except ValueError:
                pass
        # HDG / HDT — heading
        elif talker_type.endswith("HDT") or ",HDT," in line[:10]:
            try:
                h = float(_nmea_field(line, 1) or "nan")
                if h == h:
                    out["heading_true_deg"] = round(h, 1)
            except ValueError:
                pass
        elif talker_type.endswith("HDG") or ",HDG," in line[:10]:
            try:
                h = float(_nmea_field(line, 1) or "nan")
                if h == h:
                    out["heading_mag_deg"] = round(h, 1)
            except ValueError:
                pass
        # MWD — wind direction and speed, both True and Magnetic compass
        # bearings, already motion-corrected by the instrument (same "true"
        # computation as MWV reference T / VWT, just expressed as an absolute
        # bearing instead of an angle relative to the bow). Confirmed live
        # 2026-08-15: twd_true_deg == heading_true_deg + twa_deg (from HDT/
        # MWV T) to the decimal, so this is a genuine sensor reading, not a
        # relabeled apparent value. Speed fields (5-8) are redundant with
        # MWV's tws_kn/tws_ms, not parsed here.
        elif talker_type.endswith("MWD") or ",MWD," in line[:10]:
            twd_true = _bearing_deg(_float_or_none(_nmea_field(line, 1)))
            if twd_true is not None:
                out["twd_true_deg"] = twd_true
            twd_mag = _bearing_deg(_float_or_none(_nmea_field(line, 3)))
            if twd_mag is not None:
                out["twd_magnetic_deg"] = twd_mag
        # MTA — air temperature (issue #32). Only present if the boat's N2K
        # bus actually has an air-temp sensor -- absent is a valid, common
        # case, not a parse failure.
        elif talker_type.endswith("MTA") or ",MTA," in line[:10]:
            try:
                t = float(_nmea_field(line, 1) or "nan")
                if t == t:
                    out["air_temp_c"] = round(t, 1)
            except ValueError:
                pass
        # MTW — water temperature (issue #32). Same caveat as MTA above.
        elif talker_type.endswith("MTW") or ",MTW," in line[:10]:
            try:
                t = float(_nmea_field(line, 1) or "nan")
                if t == t:
                    out["water_temp_c"] = round(t, 1)
            except ValueError:
                pass
        # MDA — meteorological composite (baro + air + water). YDWG only
        # for air; baro/water also appear as XDR/MTW on both gateways.
        elif talker_type.endswith("MDA") or ",MDA," in line[:10]:
            baro_bar = _float_or_none(_nmea_field(line, 3))
            if baro_bar is not None:
                out["baro_hpa"] = round(baro_bar * 1000.0, 1)
            air = _float_or_none(_nmea_field(line, 5))
            if air is not None:
                out["air_temp_c"] = round(air, 1)
            water = _float_or_none(_nmea_field(line, 7))
            if water is not None:
                out["water_temp_c"] = round(water, 1)
        # XDR — transducers (air/baro/attitude/engines + DataHub rad TWD)
        elif talker_type.endswith("XDR") or ",XDR," in line[:10]:
            _apply_xdr(line, out)
        # RPM — engine/shaft. YDWG $YDRPM only; DataHub never sends this.
        elif talker_type.endswith("RPM") or ",RPM," in line[:10]:
            src = _nmea_field(line, 1).upper()
            inst = _nmea_field(line, 2)
            rpm = _float_or_none(_nmea_field(line, 3))
            status = _nmea_field(line, 5).upper()
            if src == "E" and inst.isdigit() and rpm is not None and status != "V":
                out[f"engine_{inst}_rpm"] = round(rpm, 1)
        # HDM — magnetic heading (simpler than HDG; same quantity)
        elif talker_type.endswith("HDM") or ",HDM," in line[:10]:
            h = _bearing_deg(_float_or_none(_nmea_field(line, 1)))
            if h is not None:
                out["heading_mag_deg"] = h
        # RSA — rudder sensor angle. Skip invalid (DataHub often sends ,,V)
        elif talker_type.endswith("RSA") or ",RSA," in line[:10]:
            if _nmea_field(line, 2).upper() == "A":
                r = _float_or_none(_nmea_field(line, 1))
                if r is not None:
                    out["rudder_deg"] = round(r, 1)
        # VHW — water heading / speed through water
        elif talker_type.endswith("VHW") or ",VHW," in line[:10]:
            ht = _bearing_deg(_float_or_none(_nmea_field(line, 1)))
            if ht is not None:
                out["heading_true_deg"] = ht
            hm = _bearing_deg(_float_or_none(_nmea_field(line, 3)))
            if hm is not None:
                out["heading_mag_deg"] = hm
            stw = _float_or_none(_nmea_field(line, 5))
            if stw is not None:
                out["stw_kn"] = round(stw, 2)
        # ROT — rate of turn, deg/min
        elif talker_type.endswith("ROT") or ",ROT," in line[:10]:
            if _nmea_field(line, 2).upper() != "V":
                rot = _float_or_none(_nmea_field(line, 1))
                if rot is not None:
                    out["rot_deg_min"] = round(rot, 1)
        # VLW — water log
        elif talker_type.endswith("VLW") or ",VLW," in line[:10]:
            total = _float_or_none(_nmea_field(line, 1))
            if total is not None:
                out["log_nm"] = round(total, 3)
            trip = _float_or_none(_nmea_field(line, 3))
            if trip is not None:
                out["trip_nm"] = round(trip, 3)
        # GGA — fix quality
        elif talker_type.endswith("GGA") or ",GGA," in line[:10]:
            lat = _latlon(_nmea_field(line, 2), _nmea_field(line, 3))
            lon = _latlon(_nmea_field(line, 4), _nmea_field(line, 5))
            try:
                qual = int(_nmea_field(line, 6) or "0")
            except ValueError:
                qual = 0
            if lat is not None:
                out["latitude"] = round(lat, 6)
            if lon is not None:
                out["longitude"] = round(lon, 6)
            out["gps_fix"] = qual > 0
            out["gps_quality"] = qual
    return out


# ---------------------------------------------------------------------------
# Policy: YDWG first, DataHub failover
# ---------------------------------------------------------------------------

def choose_active(cfg: dict[str, Any]) -> dict[str, Any]:
    order = sorted(cfg.values(), key=lambda g: g["priority"])
    results = []
    active = None
    for g in order:
        ok = tcp_open(g["host"], g["port"])
        row = {
            "id": g["id"],
            "name": g["name"],
            "host": g["host"],
            "port": g["port"],
            "online": ok,
            "priority": g["priority"],
        }
        results.append(row)
        if ok and active is None:
            active = row
    return {
        "gateways": results,
        "active": active["id"] if active else "none",
        "active_host": active["host"] if active else None,
        "active_port": active["port"] if active else None,
        "policy": "ydwg_first_then_datahub",
    }


def build_status(sample_seconds: float = 2.5) -> dict[str, Any]:
    cfg = _cfg()
    health = choose_active(cfg)
    payload: dict[str, Any] = {
        **health,
        "ok": health["active"] != "none",
        "parsed": {},
        "sentence_count": 0,
        "sample_talkers": [],
    }
    if health["active"] == "none":
        payload["error"] = "no_gateway_online"
        return payload
    lines = nmea_sample(
        health["active_host"], int(health["active_port"]), seconds=sample_seconds
    )
    payload["sentence_count"] = len(lines)
    payload["sample_talkers"] = sorted(
        {ln[1:6] for ln in lines if len(ln) > 6}
    )[:20]
    payload["parsed"] = parse_nmea(lines)
    if not lines:
        payload["warning"] = "tcp_open_but_no_nmea_sentences"
    return payload


def main(argv: list[str]) -> int:
    cmd = (argv[1] if len(argv) > 1 else "status").lower()
    if cmd in ("health", "ping"):
        print(json.dumps(choose_active(_cfg()), separators=(",", ":")))
        return 0
    if cmd in ("status", "json"):
        print(json.dumps(build_status(), separators=(",", ":")))
        return 0
    if cmd == "sample":
        sec = float(argv[2]) if len(argv) > 2 else 3.0
        cfg = _cfg()
        h = choose_active(cfg)
        if h["active"] == "none":
            print("NO_GATEWAY", file=sys.stderr)
            return 1
        lines = nmea_sample(h["active_host"], int(h["active_port"]), seconds=sec)
        for ln in lines:
            print(ln)
        return 0
    print(
        "usage: nmea_gateways.py health|status|sample [seconds]",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
