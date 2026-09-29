---
title: Freezer controller (Marine Board)
id: esp/freezer
kind: device
tags: freezer controller marine board lilygo compressor thermostat temperature battery probe relay flash button led
status: unverified
script: index.sh
---
Freezer controller in the aft cockpit: DS18B20 probe, compressor switch and thermostat. Target platform is a Marine Board (Flash button click = COOL/OFF, double-click = freeze/fridge; RGB status LED); the LilyGo S3 AMOLED with a local touch screen runs it until the board is fitted.

- **Reach:** Browser on Sisu → `http://192.168.10.44/` (HA: Freezer dashboard)
- **Action:** **Freezer Thermostat** sets the target; **Freezer Compressor** can be switched manually (overrides the thermostat).
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered
- **Expect:** Temperature near target; compressor cycling. When it is not answering, HA's Freezer source tile shows offline.
- **Source:** `homeassistant/esphome/freezer_marineboard.yaml` (Marine Board) · `homeassistant/esphome/freezer.yaml` (LilyGo interim)
