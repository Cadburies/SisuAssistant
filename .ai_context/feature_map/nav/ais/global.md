---
title: Sisu Nav › AIS (global, internet)
id: nav/ais/global
kind: layer
tags: ais global internet aisstream vessels traffic mmsi
status: broken
script: global.sh
---
Internet AIS (AISStream.io) beyond VHF range — violet dots, separate from the boat's own AIS layer. Not for collision avoidance.

- **Reach:** Sisu Nav → **Layers** (top of map) → **AIS (global, internet)**
- **Action:** toggle; click a dot for MMSI/name/SOG.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers; `AISSTREAM_API_KEY` configured
- **Expect:** Violet dots in the view on a ~1 min poll. Currently the feed reports `connected: false` (WebSocket error) — see #170.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## AIS (global)`) · `sisu-nav/api/ais-global/`
