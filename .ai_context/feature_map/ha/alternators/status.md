---
title: Alternators › Board status
id: ha/alternators/status
kind: card
tags: board online house voltage charging port starboard status bands legend
status: live
script: status.sh
---
Top section: both Marine Boards online, house voltage seen by each board, charging flag, and the gauge-band legend.

- **Reach:** HA → **Alternators** → first section · `http://192.168.0.20:8123/lovelace-alternators/overview`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Boards `off` and voltages `unavailable` until the boards are on the LAN; legend reads green < setpoint (orange) < hard (red) < scale max.
- **Source:** `homeassistant/dashboards/alternators.yaml` (`## Dual alternators`) · `homeassistant/docs/ALTERNATOR_LIMITS.md`
