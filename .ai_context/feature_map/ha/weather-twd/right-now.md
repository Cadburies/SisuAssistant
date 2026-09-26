---
title: Weather TWD › Right now
id: ha/weather-twd/right-now
kind: card
tags: wind now apparent true wind speed direction twd compass max 6h
status: live
script: right-now.sh
---
Apparent and true wind speed, 6 h max TWS, true wind direction and a compass rose showing TWD.

- **Reach:** HA → **Weather TWD** → section **Right now** · `http://192.168.0.20:8123/lovelace-weather-anchor/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Speeds in kn and TWD in ° with the compass needle matching; TWS max (6h) can read `unknown` shortly after an HA restart. If the NMEA gateway goes silent, wind values turn `unavailable` after 30 s.
- **Source:** `homeassistant/dashboards/weather_anchor.yaml` (`title: Right now`) · `homeassistant/www/twd_compass.svg`
