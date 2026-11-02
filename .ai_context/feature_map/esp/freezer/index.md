---
title: Freezer controller (Marine Board)
id: esp/freezer
kind: device
tags: freezer controller marine board compressor thermostat temperature battery probe relay flash button led
status: unverified
script: index.sh
---
Freezer controller on a Marine Board v1.9.1, pending fit, so the cabinet still runs manually: full speed or stop (#221), coil off runs at 3,500 rpm through U12 NC, and the Flash button click toggles COOL/OFF while a double-click picks freeze or fridge.

- **Reach:** Browser on Sisu → `http://192.168.10.44/` (HA: Freezer dashboard)
- **Action:** **Freezer Thermostat** sets the target from −30 °C to +20 °C; **Protection** selects Low, Med, or High. The compressor switch follows the controller.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered. It keeps cooling with no HA and no display.
- **Expect:** Temperature near target once fitted, compressor cycling. Offline, HA's Freezer source tile shows off. Wiring: MarineBoard/Documentation/Freezer-Replacement-Plan.md.
- **Source:** `homeassistant/esphome/freezer_marineboard.yaml` · `MarineBoard/Documentation/Freezer-Replacement-Plan.md`
