---
title: Trending › HA → InfluxDB
id: ha/trending/influx
kind: flow
tags: trending influxdb history long term grafana bucket sisu raw 1m
status: live
script: influx.sh
---
HA writes its canonical entities into InfluxDB bucket **Sisu** on the F8; Flux tasks derive `Sisu_raw` (7 days) and `Sisu_1m` (1-minute) for Grafana.

- **Reach:** HA → Settings → Devices & services → **InfluxDB** (UI config entry) · data lands on `http://192.168.0.21:8086`
- **Action:** none day to day; Grafana reads the buckets.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; F8 InfluxDB running
- **Expect:** InfluxDB `/health` passes; Grafana panels show recent data. Known issue #169: bucket `Sisu_1m` is missing, so ≥1 h views are empty.
- **Source:** `homeassistant/packages/trending_influxdb.yaml` · `homeassistant/influx-tasks/` · `.ai_context/data_flow.md`
