---
title: Freezer controller (LilyGo)
id: esp/freezer
kind: device
tags: freezer controller lilygo amoled compressor thermostat temperature battery probe
status: unverified
script: index.sh
---
LilyGo S3 AMOLED freezer controller in the aft cockpit: DS18B20 probe, compressor switch, thermostat and a local screen.

- **Reach:** Browser on Sisu → `http://192.168.10.44/` (HA: Freezer dashboard)
- **Action:** **Freezer Thermostat** sets the target; **Freezer Compressor** can be switched manually (overrides the thermostat).
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered
- **Expect:** Temperature near target; compressor cycling. Currently not answering (#164 notes the source tile still shows online).
- **Source:** `homeassistant/esphome/freezer.yaml`
