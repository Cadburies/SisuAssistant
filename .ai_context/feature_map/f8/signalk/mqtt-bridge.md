---
title: Signal K › MQTT bridge & sensors plugins
id: f8/signalk/mqtt-bridge
kind: service
tags: signal k mqtt bridge sensors plugin kernel sisu v1 topics mapping
status: live
script: mqtt-bridge.sh
audience: agent
---
Plugins that pull the HA/MQTT kernel topics into Signal K paths (alternators, house voltage, environment).

- **Reach:** `http://192.168.0.21:3000/admin/` → Server → **Plugin Config** → *signalk-mqtt-bridge* / *signalk-mqtt-sensors*
- **Action:** enable/disable, edit topic → path mappings (map file is a single-owner hotspot).
- **Needs:** on the boat's Sisu Wi-Fi/LAN; Signal K admin login
- **Expect:** Both plugins enabled and green; mapped paths appear in the Data Browser.
- **Source:** `homeassistant/signalk/plugin-config-data/``signalk-mqtt-bridge.json` · `homeassistant/signalk/plugin-config-data/``signalk-mqtt-sensors.json` · `scripts/signalk-inject-mqtt-creds.sh`
