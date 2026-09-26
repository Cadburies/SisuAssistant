---
title: Power › Flows view
id: ha/power/flows
kind: view
tags: power flow diagram energy history house voltage alternator current
status: live
script: flows.sh
---
Flows tab: a text power-flow diagram (solar, alternators, shore → house bank → loads) and a history graph of house voltage vs alternator current.

- **Reach:** HA → **Power** → top tab **Flows** · `http://192.168.0.20:8123/lovelace-power/flows`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** ASCII flow diagram and a note on HA's Energy menu; the graph stays flat while the alternator boards are offline.
- **Source:** `homeassistant/dashboards/power.yaml` (`path: flows`)
