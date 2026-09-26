---
title: Sisu Nav › Waves / swell
id: nav/waves/swell
kind: layer
tags: waves swell significant wave height hs direction ecmwf wam
status: live
script: swell.sh
---
Significant wave height fill and direction ticks (ECMWF WAM), ~48 h horizon.

- **Reach:** Sisu Nav → **Layers** (top of map) → **Waves / swell**
- **Action:** toggle; click a cell for Hs and direction; time slider.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers
- **Expect:** Colour fill by Hs; panel names the model that answered.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Waves / swell`) · `sisu-nav/web/src/plugins/waves/` · `sisu-nav/api/marine/` (`/api/marine`)
