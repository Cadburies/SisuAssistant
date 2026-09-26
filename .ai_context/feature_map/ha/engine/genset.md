---
title: Engine room › Genset (future)
id: ha/engine/genset
kind: control
tags: genset generator start stop preheat oil coolant hours
status: planned
script: genset.sh
---
Placeholder for a future Marine Board genset controller: running, status, oil, coolant, hours and start/stop/preheat switches.

- **Reach:** HA → **Engine** → section **Genset** · `http://192.168.0.20:8123/lovelace-engine/main`
- **Action:** the start/stop/preheat switches are placeholders — not wired to any hardware yet.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Status reads `awaiting marine board`; switches `off`; sensors `unavailable`.
- **Source:** `homeassistant/dashboards/engine.yaml` (`title: Genset`) · `homeassistant/packages/vessel_placeholders.yaml`
