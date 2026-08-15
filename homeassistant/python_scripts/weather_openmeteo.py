#!/usr/bin/env python3
"""Open-Meteo marine sea-surface-temperature fallback, for HA (issue #32).

Hourly weather forecast itself is NOT fetched here -- HA already has a
native `weather.forecast_home` entity (Met.no, via `default_config:`,
zero extra code) that supports hourly forecasts out of the box
(`weather.get_forecasts` service, `forecast_type: hourly` on the
`weather-forecast` lovelace card) -- confirmed live 2026-08-11, real
temp/wind/precipitation/condition per hour. Duplicating that with a second
API would just be redundant. Met.no also has no sea-temperature parameter
though, hence this script: Open-Meteo's Marine API
(https://open-meteo.com/en/docs/marine-weather-api), free for
non-commercial use, no API key, used purely as the water-temp fallback
when the boat's own NMEA sensor (MTW, see nmea_gateways.py) isn't fitted
or isn't reporting. Air-temp fallback uses `weather.forecast_home`'s own
`temperature` attribute instead of a second API call (see
packages/marine_environment.yaml) -- no need for this script to fetch that.

Usage:
  weather_openmeteo.py data [lat] [lon]   # JSON for the HA command_line sensor
  weather_openmeteo.py health             # reachability check only
"""
from __future__ import annotations

import datetime as dt
import json
import sys
import urllib.error
import urllib.request
from typing import Any

# Sisu's configured home position (homeassistant/configuration.yaml) -- used
# only when live GPS (sensor.nmea_latitude/longitude) is unavailable/unknown.
HOME_LAT = 18.4226
HOME_LON = -64.6180

MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def _parse_latlon(argv: list[str]) -> tuple[float, float]:
    try:
        lat = float(argv[0])
        lon = float(argv[1])
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError
        return lat, lon
    except (IndexError, ValueError):
        return HOME_LAT, HOME_LON


def _get_json(url: str, timeout: float = 8.0) -> Any:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _next_daily(times: list[Any]) -> str | None:
    """First ISO timestamp that is still in the future (UTC)."""
    now = dt.datetime.now(dt.timezone.utc)
    for raw in times or []:
        if not raw:
            continue
        try:
            t = dt.datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            continue
        if t.tzinfo is None:
            t = t.replace(tzinfo=dt.timezone.utc)
        if t >= now:
            return t.isoformat()
    return None


def data(argv: list[str]) -> dict[str, Any]:
    lat, lon = _parse_latlon(argv)
    marine = (
        f"{MARINE_URL}?latitude={lat}&longitude={lon}"
        f"&hourly=sea_surface_temperature&forecast_hours=1&timezone=UTC"
    )
    astro = (
        f"{FORECAST_URL}?latitude={lat}&longitude={lon}"
        f"&daily=moonrise,moonset&timezone=UTC&forecast_days=3"
    )
    out: dict[str, Any] = {
        "online": False,
        "lat": lat,
        "lon": lon,
        "water_temp_c_fallback": None,
        "moonrise": None,
        "moonset": None,
    }
    try:
        m = _get_json(marine)
        sst = m.get("hourly", {}).get("sea_surface_temperature", [])
        out["water_temp_c_fallback"] = sst[0] if sst else None
        out["online"] = True
    except (urllib.error.URLError, OSError, ValueError, KeyError) as err:
        out["error"] = str(err)
    try:
        a = _get_json(astro)
        daily = a.get("daily") or {}
        out["moonrise"] = _next_daily(daily.get("moonrise"))
        out["moonset"] = _next_daily(daily.get("moonset"))
        out["online"] = True
    except (urllib.error.URLError, OSError, ValueError, KeyError) as err:
        out["astro_error"] = str(err)
    return out


def health() -> dict[str, Any]:
    try:
        m = _get_json(f"{MARINE_URL}?latitude={HOME_LAT}&longitude={HOME_LON}&hourly=sea_surface_temperature&forecast_hours=1")
        return {"ok": "hourly" in m}
    except (urllib.error.URLError, OSError, ValueError) as err:
        return {"ok": False, "error": str(err)}


def main() -> None:
    args = sys.argv[1:]
    if args and args[0] == "health":
        print(json.dumps(health()))
        return
    if args and args[0] == "data":
        args = args[1:]
    print(json.dumps(data(args)))


if __name__ == "__main__":
    main()
