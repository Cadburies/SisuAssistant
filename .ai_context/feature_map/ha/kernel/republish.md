---
title: Kernel › MQTT/Signal K republish automations
id: ha/kernel/republish
kind: flow
tags: automation republish mqtt signal k alternator house voltage aws trend saloon sparkline
status: live
script: republish.sh
---
Automations that republish alternator and house-voltage values to MQTT/Signal K and send the 1 h AWS trend to the saloon display.

- **Reach:** HA → Settings → Automations → names starting `Sisu ·` · `http://192.168.0.20:8123/config/automation/dashboard`
- **Action:** each can be disabled/enabled or run manually from its menu.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** All `on`; the AWS trend fires every few minutes; alternator republish only fires while the boards send data.
- **Source:** `homeassistant/automations.yaml` (`sisu_mqtt_alt_port` …) · `homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json`
