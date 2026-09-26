---
title: Sisu Nav › AIS (global, internet)
id: nav/ais/global
kind: layer
tags: ais global internet aisstream vessels traffic mmsi
status: live
script: global.sh
---
Internet AIS (AISStream.io) beyond VHF range — violet dots, separate from the boat's own AIS layer. Not for collision avoidance.

- **Reach:** Sisu Nav → **Layers** (top of map) → **AIS (global, internet)**
- **Action:** toggle; click a dot for MMSI/name/SOG.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers; `AISSTREAM_API_KEY` configured
- **Expect:** Violet dots in the view on a ~1 min poll. If AISStream refuses connections the panel shows the error and the server retries every ≤60 s on its own.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## AIS (global)`) · `sisu-nav/api/ais-global/` · `sisu-nav/web/src/plugins/ais-global/`
