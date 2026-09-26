---
title: Alternator Port › Setpoints
id: esp/alt-port/setpoints
kind: control
tags: setpoints current voltage absorption float temperature bms tail rpm gate budget port
status: unverified
script: setpoints.sh
---
User setpoints (layer 3 of the limits model): current, absorption/float/charged voltage, temperature, BMS capacity/tail/charged time, absorption max time, house current budget, RPM gate.

- **Reach:** `http://192.168.10.41/` → the **numbers** ending `· Port` (HA: Alternators › Port)
- **Action:** change a number → new target for the charge controller, always clamped below the fixed hard limits (250 A / 14.4 V / 125 °C) which no UI can change. ⚠️ Safety-critical.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered; Port Marine Board fitted and online (#11); human on board
- **Expect:** Numbers show current values; a change takes effect within a control cycle and is kept across reboots.
- **Source:** `homeassistant/esphome/packages/marine_alternator.yaml` · `homeassistant/docs/ALTERNATOR_LIMITS.md`
