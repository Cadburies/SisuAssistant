---
title: Grafana › Tanks & Watermaker
id: f8/grafana/tanks-watermaker
kind: dashboard
tags: grafana tanks & watermaker trend history chart
status: live
script: tanks-watermaker.sh
---
Tank levels and watermaker runs (6 panels).

- **Reach:** Grafana → Dashboards → **Tanks & Watermaker** · `http://192.168.0.21:3001/d/sisu-tanks-watermaker`
- **Action:** pick a time range; hover for values.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; Grafana login
- **Expect:** Panels draw recent data from `Sisu_raw` (short windows) or `Sisu_1m` (≥1 h); frozen NMEA quantities show flat lines (#162). Known issue #169: bucket `Sisu_1m` is missing, so ≥1 h views are empty.
- **Source:** `homeassistant/grafana-provisioning/dashboards/``sisu-tanks-watermaker.json`
