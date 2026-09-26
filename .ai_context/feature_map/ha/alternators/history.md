---
title: Alternators › History
id: ha/alternators/history
kind: view
tags: alternator history graph current voltage temperature field duty trend
status: live
script: history.sh
---
History view: 1-hour graphs of current and house voltage, and of temperature and field duty, for both sides.

- **Reach:** HA → **Alternators** → top tab **History** · `http://192.168.0.20:8123/lovelace-alternators/history`
- **Action:** display only; hover/tap a graph for values.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Two graphs with Port and Starboard lines; flat/empty while the boards are offline.
- **Source:** `homeassistant/dashboards/alternators.yaml` (`path: history`)
