---
title: Engine room › Firmware diagnostics
id: ha/engine/firmware-diagnostics
kind: control
tags: firmware diagnostics debug level reset reason loop time esp32 alternator board
status: unverified
script: firmware-diagnostics.sh
---
Per-board debug-level selector (0–3), last reset reason and main-loop time for the Port and Starboard Marine Boards.

- **Reach:** HA → **Engine** → section **Firmware diagnostics** · `http://192.168.0.20:8123/lovelace-engine/main`
- **Action:** change **Debug level** → sets the board's runtime log verbosity (0 = quiet … 3 = verbose); no effect on charging.
- **Needs:** both Marine Boards online (#11) · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Rows show the level, a reset reason like `Power on` and loop time in ms once the boards register (ids corrected in #163; still to be confirmed on first registration).
- **Source:** `homeassistant/dashboards/engine.yaml` (`title: Firmware diagnostics`) · `homeassistant/esphome/packages/esp_diag.yaml`
