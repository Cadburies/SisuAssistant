---
title: Weather TWD › Wind history
id: ha/weather-twd/wind-history
kind: card
tags: wind history 5 minutes hour 24 hours 7 days aws tws twd graph trend
status: live
script: wind-history.sh
---
Wind speed (AWS/TWS) and direction (TWD) graphs for the last 5 minutes, hour, 24 hours and 7 days.

- **Reach:** HA → **Weather TWD** → sections **Last 5 minutes … Last 7 days** · `http://192.168.0.20:8123/lovelace-weather-anchor/main`
- **Action:** display only; hover for values.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Pairs of graphs per time scale; long spans show wind shifts and gust patterns.
- **Source:** `homeassistant/dashboards/weather_anchor.yaml` (`title: Last 5 minutes`)
