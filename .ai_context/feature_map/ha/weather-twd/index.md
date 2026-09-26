---
title: Weather TWD › Dashboard
id: ha/weather-twd
kind: dashboard
tags: weather twd true wind direction anchor dashboard
status: live
script: index.sh
---
True-wind-at-anchor dashboard: forecast, live wind with TWD compass, wind history at four time scales, and atmosphere.

- **Reach:** HA → sidebar **Weather TWD** (or Sisu › Ship zones) · `http://192.168.0.20:8123/lovelace-weather-anchor/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Header explains TWD is compass-north (MWD), not AWA off the bow, and links Grafana wind roses.
- **Source:** `homeassistant/dashboards/weather_anchor.yaml` · `homeassistant/configuration.yaml` (`lovelace-weather-anchor`)
