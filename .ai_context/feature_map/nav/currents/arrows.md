---
title: Sisu Nav › Currents
id: nav/currents/arrows
kind: layer
tags: currents surface current smoc meteo france arrows knots
status: live
script: arrows.sh
---
Surface current arrows (Meteo-France SMOC, ~8 km), pointing where the water goes.

- **Reach:** Sisu Nav → **Layers** (top of map) → **Currents**
- **Action:** toggle; click an arrow for speed/direction; time slider.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers
- **Expect:** Arrows sized/coloured by speed 0–4 kn+.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Currents`) · `sisu-nav/web/src/plugins/currents/` · `sisu-nav/api/marine/` (`/api/marine`)
