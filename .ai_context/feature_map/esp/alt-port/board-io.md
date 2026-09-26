---
title: Alternator Port › LED, buzzer & diagnostics
id: esp/alt-port/board-io
kind: control
tags: status led buzzer tone debug level reset reason loop time port
status: unverified
script: board-io.sh
---
Board status LED and buzzer (with tone), runtime debug level, last reset reason and loop time.

- **Reach:** `http://192.168.10.41/` → **Status LED**, **Buzzer**, **Buzzer tone Hz**, **Debug level**
- **Action:** toggle LED/buzzer (test), set tone, set log level 0–3; no effect on charging.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered; Port Marine Board fitted and online (#11)
- **Expect:** LED/buzzer respond immediately; reset reason names the last boot cause.
- **Source:** `homeassistant/esphome/packages/marine_board_base.yaml` · `homeassistant/esphome/packages/esp_diag.yaml`
