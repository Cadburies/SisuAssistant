---
title: Grafana › Power & Charging
id: f8/grafana/power-charging
kind: dashboard
tags: grafana power & charging trend history chart
status: live
script: power-charging.sh
---
House bank, solar and alternator charging trends (20 panels).

- **Reach:** Grafana → Dashboards → **Power & Charging** · `http://192.168.0.21:3001/d/sisu-power-charging`
- **Action:** pick a time range; hover for values.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; Grafana login
- **Expect:** Panels draw recent data from `Sisu_raw` (short windows) or `Sisu_1m` (≥1 h); frozen NMEA quantities show flat lines (#162). Known issue #169: bucket `Sisu_1m` is missing, so ≥1 h views are empty.
- **Source:** `homeassistant/grafana-provisioning/dashboards/``sisu-power-charging.json`
