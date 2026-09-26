---
title: Grafana › Engine & Navigation
id: f8/grafana/engine-nav
kind: dashboard
tags: grafana engine & navigation trend history chart
status: live
script: engine-nav.sh
---
Engine and navigation history (17 panels).

- **Reach:** Grafana → Dashboards → **Engine & Navigation** · `http://192.168.0.21:3001/d/sisu-engine-nav`
- **Action:** pick a time range; hover for values.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; Grafana login
- **Expect:** Panels draw recent data from `Sisu_raw` (short windows) or `Sisu_1m` (≥1 h); frozen NMEA quantities show flat lines (#162).
- **Source:** `homeassistant/grafana-provisioning/dashboards/``sisu-engine-nav.json`
