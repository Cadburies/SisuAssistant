---
title: Freezer › Power & status
id: ha/freezer/power-status
kind: card
tags: freezer battery voltage compressor battery low probe fail online
status: live
script: power-status.sh
---
Local battery voltage, compressor state, firmware cut-out, probe fail, and whether the controller is online.

- **Reach:** HA → **Freezer** → section **Power & status** · `http://192.168.0.20:8123/lovelace-freezer/main`
- **Action:** display only.
- **Needs:** freezer controller online · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Battery ~12–13 V, compressor cycling, firmware cut-out and probe fail `off`, Online `on`. Online `off` when the controller is not reachable. The cut-out follows Low, Med, or High once #221 is flashed.
- **Source:** `homeassistant/dashboards/freezer.yaml` (`title: Power & status`) · `homeassistant/esphome/freezer_marineboard.yaml`
