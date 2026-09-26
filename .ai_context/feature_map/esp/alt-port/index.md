---
title: Alternator Port › Marine Board
id: esp/alt-port
kind: device
tags: alternator port marine board esp32 web page regulator field
status: unverified
script: index.sh
---
Port alternator regulator: Marine Board (ESP32-S3) driving the alternator field, with its own web page for local control and diagnostics.

- **Reach:** Browser on Sisu → `http://192.168.10.41/` (HA: Alternators dashboard, section Port)
- **Action:** see and change every exposed control; also reachable through HA.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered; Port Marine Board fitted and online (#11)
- **Expect:** Page lists sensors and controls, updating live. Not yet on the LAN — scripts SKIP (#11).
- **Source:** `homeassistant/esphome/alternatorport.yaml` · `homeassistant/esphome/packages/marine_alternator.yaml` · `homeassistant/esphome/packages/marine_board_base.yaml`
