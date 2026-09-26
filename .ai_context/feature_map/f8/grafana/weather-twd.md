---
title: Grafana › WeatherTWD
id: f8/grafana/weather-twd
kind: dashboard
tags: grafana weathertwd trend history chart
status: live
script: weather-twd.sh
---
True wind direction and roses at anchor (19 panels) — linked from HA Weather TWD.

- **Reach:** Grafana → Dashboards → **WeatherTWD** · `http://192.168.0.21:3001/d/sisu-weather-twd`
- **Action:** pick a time range; hover for values.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; Grafana login
- **Expect:** Panels draw recent data from `Sisu_raw` (short windows) or `Sisu_1m` (≥1 h); gaps or flat lines where the NMEA feed was silent.
- **Source:** `homeassistant/grafana-provisioning/dashboards/``sisu-weather-twd.json`
