---
title: Freezer › All variables
id: ha/freezer/all-variables
kind: card
tags: freezer all variables list debug level reset reason diagnostics
status: unverified
script: all-variables.sh
---
Full list of every freezer entity, including controller diagnostics (debug level, reset reason).

- **Reach:** HA → **Freezer** → section **All variables** · `http://192.168.0.20:8123/lovelace-freezer/main`
- **Action:** change **Debug level** → sets the controller's log verbosity (0–3).
- **Needs:** freezer controller online · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Every row filled while the controller is online, including debug level and reset reason. Prefix `aft_cockpit_sisu_freezer_` matches the live device (area Aft Cockpit + Sisu Freezer). Debug and reset register once that controller is online (#172).
- **Source:** `homeassistant/dashboards/freezer.yaml` (`title: All variables`) · `homeassistant/esphome/freezer.yaml`
