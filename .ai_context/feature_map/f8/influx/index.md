---
title: InfluxDB › UI & buckets
id: f8/influx
kind: service
tags: influxdb database buckets data explorer tasks 8086
status: live
script: index.sh
---
InfluxDB 2 on the F8: bucket **Sisu** (HA writes), **Sisu_raw** (7-day mirror) and **Sisu_1m** (1-minute rollup).

- **Reach:** Browser on Sisu → `http://192.168.0.21:8086` (log in) → Data Explorer / Tasks
- **Action:** query data, check the two Flux tasks ran.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; InfluxDB login
- **Expect:** `/health` = pass; Tasks list shows `sisu_raw_mirror` and `sisu_1m` with recent successful runs.
- **Source:** `homeassistant/influx-tasks/` · `homeassistant/packages/trending_influxdb.yaml` · `scripts/influx-sisu-views.sh`
