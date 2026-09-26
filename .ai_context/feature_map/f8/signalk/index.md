---
title: Signal K › Server & admin
id: f8/signalk
kind: service
tags: signal k server admin dashboard data browser plugins 3000
status: live
script: index.sh
---
Signal K server on the F8: collects NMEA/N2K and MQTT data into one data model; admin UI for status, data browser, plugins and apps.

- **Reach:** Browser on Sisu → `http://192.168.0.21:3000/admin/` (log in)
- **Action:** browse live data (**Data Browser**), see connections/providers (**Dashboard**), manage plugins and apps.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; Signal K login (`SignalKUser`/`SignalKPwd`)
- **Expect:** Admin loads; Dashboard lists the YDWG/DataHub providers with message rates; Data Browser shows `navigation.*` paths updating.
- **Source:** `homeassistant/signalk/settings.json` · `homeassistant/docker-compose.yml` (`signalk:`) · `OPS.md` §7
