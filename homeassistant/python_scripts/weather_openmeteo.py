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


def data(argv: list[str]) -> dict[str, Any]:
    lat, lon = _parse_latlon(argv)
    url = f"{MARINE_URL}?latitude={lat}&longitude={lon}&hourly=sea_surface_temperature&forecast_hours=1&timezone=UTC"
    try:
        m = _get_json(url)
        sst = m.get("hourly", {}).get("sea_surface_temperature", [])
        return {"online": True, "lat": lat, "lon": lon,
                "water_temp_c_fallback": sst[0] if sst else None}
    except (urllib.error.URLError, OSError, ValueError, KeyError) as err:
        return {"online": False, "lat": lat, "lon": lon, "error": str(err),
                "water_temp_c_fallback": None}


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
