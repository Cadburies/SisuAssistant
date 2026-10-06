---
title: Water › Levels board diagnostics
id: ha/water/levels-diagnostics
kind: control
tags: levels board debug level reset reason loop time diagnostics
status: unverified
script: levels-diagnostics.sh
---
Debug level, reset reason and loop time for the water-levels Marine Board.

- **Reach:** HA → **Water** → section **Levels board diagnostics** · `http://192.168.0.20:8123/lovelace-water/main`
- **Action:** change **Debug level** → sets the board's log verbosity (0–3).
- **Needs:** levels board online (#2) · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Level, reset reason and loop time once the levels board is on the LAN (#2). Ids are `saloon_water_levels_*` (area Saloon + device Water Levels + name). Confirm on first registration.
- **Source:** `homeassistant/dashboards/water.yaml` · `homeassistant/esphome/packages/esp_diag.yaml`
