#!/usr/bin/env python3
"""Nearest NOAA tide station + next high/low predictions, for HA (issue #32).

NOAA doesn't stop at the US border in a way that matters here -- CO-OPS
publishes full harmonic-prediction stations in the US Virgin Islands, close
enough to BVI waters to be genuinely useful (Lameshur Bay/St John is ~9nm
from Sisu's home position). Free, public, no API key -- api.tidesandcurrents.noaa.gov.

Nearest-station selection is dynamic: takes the vessel's live GPS (passed as
argv, sourced from sensor.nmea_latitude/longitude by the HA command_line
template) and picks the closest of a short hardcoded candidate list via
haversine distance, falling back to Sisu's configured home position
(configuration.yaml `homeassistant:` block) when GPS is unavailable. Extend
CANDIDATE_STATIONS if the cruising range grows beyond USVI/BVI.

Fetches are cached to disk with a multi-hour TTL -- tide predictions don't
need per-minute freshness, and this is a keyless public API worth being a
good citizen of rather than hammering on every dashboard refresh.

Usage:
  tides_noaa.py data [lat] [lon]   # JSON for the HA command_line sensor (default)
  tides_noaa.py health             # reachability check only
"""
from __future__ import annotations

import json
import math
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# Sisu's configured home position (homeassistant/configuration.yaml) -- used
# only when live GPS (sensor.nmea_latitude/longitude) is unavailable/unknown.
HOME_LAT = 18.4226
HOME_LON = -64.6180

# NOAA CO-OPS harmonic-prediction stations near BVI/USVI cruising ground
# (id, name, lat, lon). Confirmed live 2026-08-11 -- both support
# product=predictions&interval=hilo.
CANDIDATE_STATIONS: list[tuple[str, str, float, float]] = [
    ("9751381", "Lameshur Bay, St John", 18.31825, -64.72422),
    ("9751639", "Charlotte Amalie, St Thomas", 18.330584, -64.925804),
]

CACHE_PATH = Path("/config/.cache/tides_noaa.json")
CACHE_TTL_S = 3 * 60 * 60  # 3h -- plenty fresh for tide predictions
NOAA_BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"


def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r_nm = 3440.065  # earth radius in nautical miles
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r_nm * math.asin(math.sqrt(a))


def _nearest_station(lat: float, lon: float) -> tuple[str, str, float]:
    best = min(CANDIDATE_STATIONS, key=lambda s: _haversine_nm(lat, lon, s[2], s[3]))
    dist = _haversine_nm(lat, lon, best[2], best[3])
    return best[0], best[1], round(dist, 1)


def _parse_latlon(argv: list[str]) -> tuple[float, float]:
    try:
        lat = float(argv[0])
        lon = float(argv[1])
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError
        return lat, lon
    except (IndexError, ValueError):
        return HOME_LAT, HOME_LON


def _fetch_predictions(station_id: str) -> list[dict[str, Any]]:
    today = datetime.now(timezone.utc).date()
    params = {
        "product": "predictions",
        "datum": "MLLW",
        "station": station_id,
        "time_zone": "gmt",
        "units": "metric",  # Sisu is metric -- heights in meters, not feet
        "interval": "hilo",
        "format": "json",
        "begin_date": today.strftime("%Y%m%d"),
        "end_date": (today + timedelta(days=3)).strftime("%Y%m%d"),
    }
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"{NOAA_BASE}?{qs}"
    with urllib.request.urlopen(url, timeout=8) as resp:
        body = json.loads(resp.read().decode())
    if "error" in body:
        raise ValueError(body["error"].get("message", "NOAA API error"))
    return body.get("predictions", [])


def _next_hilo(predictions: list[dict[str, Any]]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    next_high = next_low = None
    for p in predictions:
        t = datetime.strptime(p["t"], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
        if t <= now:
            continue
        if p["type"] == "H" and next_high is None:
            next_high = (t, float(p["v"]))
        elif p["type"] == "L" and next_low is None:
            next_low = (t, float(p["v"]))
        if next_high and next_low:
            break
    return {
        "next_high_time": next_high[0].isoformat() if next_high else None,
        "next_high_m": round(next_high[1], 2) if next_high else None,
        "next_low_time": next_low[0].isoformat() if next_low else None,
        "next_low_m": round(next_low[1], 2) if next_low else None,
    }


def _read_cache() -> dict[str, Any] | None:
    try:
        if time.time() - CACHE_PATH.stat().st_mtime > CACHE_TTL_S:
            return None
        return json.loads(CACHE_PATH.read_text())
    except (OSError, ValueError):
        return None


def _write_cache(payload: dict[str, Any]) -> None:
    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(payload))
    except OSError:
        pass  # cache is a nice-to-have, not required for correctness


def data(argv: list[str]) -> dict[str, Any]:
    lat, lon = _parse_latlon(argv)
    station_id, station_name, dist_nm = _nearest_station(lat, lon)

    cached = _read_cache()
    if cached and cached.get("station_id") == station_id:
        cached["cached"] = True
        return cached

    try:
        predictions = _fetch_predictions(station_id)
    except (urllib.error.URLError, OSError, ValueError, KeyError) as err:
        return {"online": False, "error": str(err), "station_id": station_id,
                "station_name": station_name, "station_distance_nm": dist_nm}

    payload: dict[str, Any] = {
        "online": True,
        "station_id": station_id,
        "station_name": station_name,
        "station_distance_nm": dist_nm,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "cached": False,
    }
    payload.update(_next_hilo(predictions))
    _write_cache(payload)
    return payload


def health() -> dict[str, Any]:
    try:
        preds = _fetch_predictions(CANDIDATE_STATIONS[0][0])
        return {"ok": True, "sample_count": len(preds)}
    except (urllib.error.URLError, OSError, ValueError) as err:
        return {"ok": False, "error": str(err)}


def main() -> None:
    args = sys.argv[1:]
    if args and args[0] == "health":
        print(json.dumps(health()))
        return
    # Accept both `tides_noaa.py data <lat> <lon>` and `tides_noaa.py <lat> <lon>`.
    if args and args[0] == "data":
        args = args[1:]
    print(json.dumps(data(args)))


if __name__ == "__main__":
    main()
