---
title: Helm › NMEA instruments
id: ha/helm/nmea-instruments
kind: card
tags: nmea instruments sog cog depth aws awa heading latitude longitude fix gps
status: live
script: nmea-instruments.sh
---
Live NMEA values from the kernel (YDWG first, DataHub on failover): SOG, COG, depth, apparent wind, magnetic heading, position and fix.

- **Reach:** HA → **Helm** → section **NMEA instruments (YDWG → DataHub)** · `http://192.168.0.20:8123/lovelace-helm/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Values update every few seconds; `has fix` = on; position shown in decimal degrees. If the NMEA gateway goes silent, values turn `unavailable` after 30 s instead of freezing.
- **Source:** `homeassistant/dashboards/helm.yaml` (`title: NMEA instruments`) · `homeassistant/packages/source_health.yaml` · `homeassistant/nmea_wind_daemon/nmea_wind_daemon.py`
