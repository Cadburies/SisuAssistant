---
title: MQTT Explorer
id: f8/mqtt-explorer
kind: service
tags: mqtt explorer topics browser kernel sisu v1 debug
status: live
script: index.sh
---
Web MQTT Explorer on the F8 for browsing live kernel topics (`sisu/v1/#`, `sisu/nmea/#`).

- **Reach:** Browser on Sisu → `http://192.168.0.21:4000` → connect to `192.168.0.20:1883`
- **Action:** browse topics, see retained values and message rates.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; MQTT credentials
- **Expect:** Topic tree fills within seconds; each `sisu/v1` value shows `source` and `stale_s` (large `stale_s` = frozen, see #162).
- **Source:** `homeassistant/docker-compose.yml` (`mqtt-explorer:`) · `.ai_context/data_flow.md`
