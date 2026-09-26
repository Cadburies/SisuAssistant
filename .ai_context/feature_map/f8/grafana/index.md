---
title: Grafana › Home
id: f8/grafana
kind: service
tags: grafana charts trends history dashboards 3001
status: live
script: index.sh
---
Grafana on the F8 for long-range charts from InfluxDB: power & charging, engine & navigation, tanks & watermaker, wind (AWA and TWD).

- **Reach:** Browser on Sisu → `http://192.168.0.21:3001` (log in) → Dashboards
- **Action:** open a dashboard, change the time range, zoom a panel.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; Grafana login
- **Expect:** Login page, then the five provisioned **Sisu** dashboards in the list. Known issue #169: bucket `Sisu_1m` is missing, so ≥1 h views are empty.
- **Source:** `homeassistant/grafana-provisioning/dashboards/` · `homeassistant/grafana-provisioning/datasources/influxdb.yaml`
