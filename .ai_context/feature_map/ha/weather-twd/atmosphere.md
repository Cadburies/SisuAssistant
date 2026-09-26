---
title: Weather TWD › Atmosphere
id: ha/weather-twd/atmosphere
kind: card
tags: air water temperature barometric pressure humidity trend
status: live
script: atmosphere.sh
---
Air and water temperature, barometric pressure, humidity and a pressure history graph.

- **Reach:** HA → **Weather TWD** → section **Atmosphere** · `http://192.168.0.20:8123/lovelace-weather-anchor/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Pressure around 1010–1020 hPa; a falling trend warns of weather.
- **Source:** `homeassistant/dashboards/weather_anchor.yaml` (`title: Atmosphere`) · `homeassistant/packages/marine_environment.yaml`
