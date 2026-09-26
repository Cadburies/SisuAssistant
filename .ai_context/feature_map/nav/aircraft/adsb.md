---
title: Sisu Nav › Aircraft
id: nav/aircraft/adsb
kind: layer
tags: aircraft adsb planes overhead adsb lol
status: live
script: adsb.sh
order: 82
---
Live ADS-B aircraft in the current view (adsb.lol). Not collision avoidance.

- **Reach:** Sisu Nav → **Layers** (top of map) → **Aircraft**
- **Action:** toggle; click for flight details.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers
- **Expect:** Aircraft icons where traffic exists; empty list over quiet water is normal.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Aircraft`) · `sisu-nav/api/aircraft/` · `sisu-nav/web/src/plugins/aircraft/`
