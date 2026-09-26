---
title: Saloon display › Wind page
id: esp/saloon-display/wind
kind: page
tags: saloon display wind sparkline trend aws max 1h
status: live
script: wind.sh
---
Apparent-wind trend sparkline for the last hour with the 1 h maximum.

- **Reach:** Saloon display → swipe left from Home
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered
- **Expect:** Sparkline updates every few minutes (fed by HA's AWS 1 h trend automation).
- **Source:** `homeassistant/esphome/saloon_display.yaml` (`page_wind`) · `homeassistant/automations.yaml` (`sisu_wind_trend_aws_1h`)
