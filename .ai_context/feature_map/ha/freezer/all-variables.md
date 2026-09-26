---
title: Freezer › All variables
id: ha/freezer/all-variables
kind: card
tags: freezer all variables list debug level reset reason diagnostics
status: broken
script: all-variables.sh
---
Full list of every freezer entity, including controller diagnostics (debug level, reset reason).

- **Reach:** HA → **Freezer** → section **All variables** · `http://192.168.0.20:8123/lovelace-freezer/main`
- **Action:** change **Debug level** → sets the controller's log verbosity (0–3).
- **Needs:** freezer controller online · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Every row filled while the controller is online. Currently broken: the diagnostics rows point at `select.freezer_debug_level` / `text_sensor.freezer_reset_reason`, which HA does not have (text sensors appear as `sensor.*`, and the device's entities carry the `aft_cockpit_sisu_freezer_` prefix). Tracked in #163.
- **Source:** `homeassistant/dashboards/freezer.yaml` (`title: All variables`) · `homeassistant/esphome/freezer.yaml`
