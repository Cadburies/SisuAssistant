---
title: Freezer display › Device
id: esp/freezer-display
kind: device
tags: freezer display lilygo amoled touch screen setpoint fridge
status: unverified
script: index.sh
---
LilyGo S3 AMOLED touch screen for the freezer in the aft cockpit. Display only: it shows the Marine Board controller's temperature, setpoint, mode and compressor state from HA and sends taps to the controller as HA climate actions.

- **Reach:** Walk up to the freezer display (web page `http://192.168.10.47/`)
- **Action:** right strip +/− changes the setpoint; title pill toggles COOL/OFF; SET line toggles freeze/fridge.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); HA up; "Allow the device to perform Home Assistant actions" on in HA
- **Expect:** LINK in the title; NO HA when HA is down, CTRL OFF when the controller is offline (the fridge keeps running either way).
- **Source:** `homeassistant/esphome/freezer_display.yaml`
