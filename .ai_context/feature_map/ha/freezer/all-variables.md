---
title: Freezer › All variables
id: ha/freezer/all-variables
kind: card
tags: freezer all variables list debug level reset reason diagnostics
status: unverified
script: all-variables.sh
---
List of the registered freezer entities, including the firmware cut-out.

- **Reach:** HA → **Freezer** → section **All variables** · `http://192.168.0.20:8123/lovelace-freezer/main`
- **Action:** read the list. Debug level and reset reason are not on this card until those entities are registered (#163).
- **Needs:** freezer controller online · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** The listed rows are filled while the controller is online. The battery row is the firmware cut-out. Protection and fault code join once #221 registers. Prefix `aft_cockpit_sisu_freezer_`.
- **Source:** `homeassistant/dashboards/freezer.yaml` (`title: All variables`) · `homeassistant/esphome/freezer_marineboard.yaml`
