---
title: Grafana › WeatherAWA
id: f8/grafana/weather
kind: dashboard
tags: grafana weatherawa trend history chart
status: live
script: weather.sh
---
Apparent wind speed/angle history (20 panels).

- **Reach:** Grafana → Dashboards → **WeatherAWA** · `http://192.168.0.21:3001/d/sisu-weather`
- **Action:** pick a time range; hover for values.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; Grafana login
- **Expect:** Panels draw recent data from `Sisu_raw` (short windows) or `Sisu_1m` (≥1 h); gaps or flat lines where the NMEA feed was silent. Known issue #169: bucket `Sisu_1m` is missing, so ≥1 h views are empty.
- **Source:** `homeassistant/grafana-provisioning/dashboards/``sisu-weather.json`
