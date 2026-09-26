---
title: Kernel › MQTT broker (sisu/v1)
id: ha/kernel/mqtt
kind: service
tags: mqtt broker mosquitto kernel sisu v1 topics
status: live
script: mqtt.sh
---
HA Green's Mosquitto broker carries the `sisu/v1` kernel topics that HA, Signal K and the saloon display read.

- **Reach:** HA → Settings → Add-ons → **Mosquitto broker** · broker `192.168.0.20:1883`
- **Action:** none from the UI; tools subscribe to `sisu/v1/#`.
- **Needs:** on the boat LAN · MQTT credentials `mqtt_username`/`mqtt_password`; reached via the HA Green hop
- **Expect:** A retained kernel topic answers immediately, e.g. `sisu/v1/meta/datahub/live` → `true` while DataHub delivers.
- **Source:** `scripts/ha-kernel-mqtt.sh` · `homeassistant/addons/sisu_nmea_ingest/` · `.ai_context/data_flow.md`
