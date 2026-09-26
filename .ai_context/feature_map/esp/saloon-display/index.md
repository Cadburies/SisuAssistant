---
title: Saloon display › Device
id: esp/saloon-display
kind: device
tags: saloon display waveshare touch screen guest lvgl
status: live
script: index.sh
---
Wall-mounted Waveshare 4.3" touch display in the saloon for guests: three swipeable pages (Home, Wind, Wi-Fi).

- **Reach:** Walk up to the saloon display (web page `http://192.168.10.45/`)
- **Action:** swipe left/right to change page.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered
- **Expect:** Home page on boot; data refreshes from HA/MQTT.
- **Source:** `homeassistant/esphome/saloon_display.yaml` · `homeassistant/automations.yaml` (`sisu_wind_trend_aws_1h`)
