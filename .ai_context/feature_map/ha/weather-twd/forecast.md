---
title: Weather TWD › Forecast
id: ha/weather-twd/forecast
kind: card
tags: weather forecast met no daily hourly
status: live
script: forecast.sh
---
Local weather forecast card (Met.no).

- **Reach:** HA → **Weather TWD** → first section · `http://192.168.0.20:8123/lovelace-weather-anchor/main`
- **Action:** tap the card for hourly/daily detail.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Current condition icon and temperature with the coming days.
- **Source:** `homeassistant/dashboards/weather_anchor.yaml` (`weather-forecast`)
