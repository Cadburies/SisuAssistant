---
title: Sisu Nav › Weather wind & discrepancies
id: nav/weather/wind
kind: layer
tags: weather forecast wind gfs ecmwf icon gem models discrepancy particles time slider
status: live
script: wind.sh
---
Multi-model wind forecast on the map (GFS, ECMWF IFS, ICON, GEM), a model-disagreement layer and animated particles.

- **Reach:** Sisu Nav → **Layers** (top of map) → **Weather wind** / **Wind discrepancies** / **Weather particles**
- **Action:** toggle layers; click a cell for per-model detail; drag the local-time slider.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers
- **Expect:** Wind barbs/arrows over the view; discrepancy highlights where models disagree.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Weather`) · `sisu-nav/web/src/plugins/weather/` · `sisu-nav/api/weather/` (`/api/weather`)
