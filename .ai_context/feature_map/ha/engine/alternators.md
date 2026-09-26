---
title: Engine room › Alternators summary
id: ha/engine/alternators
kind: card
tags: alternator port starboard amps house voltage charge stage temperature board online
status: live
script: alternators.sh
---
Compact alternator view: both boards online, Port/Stbd current gauges, house voltage gauge and stage/temperature list.

- **Reach:** HA → **Engine** → section **Alternators** · `http://192.168.0.20:8123/lovelace-engine/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Gauges live once the boards are on the LAN; until then `unavailable` (#11).
- **Source:** `homeassistant/dashboards/engine.yaml` (`title: Alternators`)
