---
title: Weather TWD › Dashboard
id: ha/weather-twd
kind: dashboard
tags: weather twd true wind direction anchor dashboard battery runtime load time to 20 10 soc
status: live
script: index.sh
---
True-wind-at-anchor dashboard: forecast, live wind with TWD compass, wind history at four time scales, atmosphere, and the battery runtime (net load and time to 20% / 10% SoC).

- **Reach:** HA → sidebar **Weather TWD** (or Sisu › Ship zones) · `http://192.168.0.20:8123/lovelace-weather-anchor/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Header explains TWD is compass-north (MWD), not AWA off the bow, and links Grafana wind roses; **Battery** shows the 10-minute mean load and `5 h 40 min (≈ 03:15)` to 20% / 10%, `Charging` while charging and `—` when idle.
- **Source:** `homeassistant/dashboards/weather_anchor.yaml` · `homeassistant/packages/energy_victron_stubs.yaml` (`sisu_house_load`, `sisu_time_to_20_soc`) · `homeassistant/configuration.yaml` (`lovelace-weather-anchor`)
