---
title: Alternators › Dashboard
id: ha/alternators
kind: dashboard
tags: alternators alternator dashboard charging port starboard marine board
status: live
script: index.sh
---
Dual-alternator dashboard: board status, Victron BMS, per-side gauges with setpoints, and a history view.

- **Reach:** HA → sidebar **Alternators** (or Sisu › Ship zones › Alternators) · `http://192.168.0.20:8123/lovelace-alternators/overview`
- **Action:** display plus setpoint controls (see Port / Starboard).
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Header explains board state; with both boards off the LAN it says both Marine Boards are offline and gauges read `unavailable` (#11).
- **Source:** `homeassistant/dashboards/alternators.yaml` · `homeassistant/configuration.yaml` (`lovelace-alternators`)
