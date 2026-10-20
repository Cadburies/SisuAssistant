---
title: Freezer controller (Marine Board)
id: esp/freezer
kind: device
tags: freezer controller marine board compressor thermostat temperature battery probe relay flash button led
status: unverified
script: index.sh
---
Freezer controller in the aft cockpit: DS18B20 probe, compressor relay and thermostat on a Marine Board v1.9.1, pending — the freezer runs manually until it is fitted (Flash button click = COOL/OFF, double-click = freeze/fridge). Its screen is the separate LilyGo display (esp/freezer-display).

- **Reach:** Browser on Sisu → `http://192.168.10.44/` (HA: Freezer dashboard)
- **Action:** **Freezer Thermostat** sets the target; **Freezer Compressor** can be switched manually (overrides the thermostat).
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered
- **Expect:** Temperature near target; compressor cycling. When it is not answering, HA's Freezer source tile shows offline.
- **Source:** `homeassistant/esphome/freezer_marineboard.yaml`
