---
title: Water › Levels board diagnostics
id: ha/water/levels-diagnostics
kind: control
tags: levels board debug level reset reason loop time diagnostics
status: broken
script: levels-diagnostics.sh
---
Debug level, reset reason and loop time for the water-levels Marine Board.

- **Reach:** HA → **Water** → section **Levels board diagnostics** · `http://192.168.0.20:8123/lovelace-water/main`
- **Action:** change **Debug level** → sets the board's log verbosity (0–3).
- **Needs:** levels board online (#2) · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Currently broken: board not yet on the LAN, and the reset-reason row points at a `text_sensor.*` id HA never creates. Tracked in #163.
- **Source:** `homeassistant/dashboards/water.yaml` · `homeassistant/esphome/packages/esp_diag.yaml`
