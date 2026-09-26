---
title: Kernel › NMEA ingest add-on
id: ha/kernel/nmea-ingest
kind: service
tags: nmea ingest add-on ydwg datahub dual listen kernel publisher update
status: live
script: nmea-ingest.sh
---
Local Supervisor add-on that listens to YDWG and DataHub at the same time and publishes the best value per quantity to `sisu/v1`.

- **Reach:** HA → Settings → Add-ons → **Sisu NMEA ingest** (slug `local_sisu_nmea_ingest`)
- **Action:** **Start / Restart / Rebuild** on the add-on page; the update entity offers new versions.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Add-on running; Sources dashboard shows fresh ages; the update entity reads `off` when current.
- **Source:** `homeassistant/addons/sisu_nmea_ingest/` · `scripts/ha-kernel-mqtt.sh` · `homeassistant/nmea_wind_daemon/nmea_wind_daemon.py`
