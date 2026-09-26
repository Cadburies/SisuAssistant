---
title: Sisu Nav › Layers picker
id: nav/layers/picker
kind: panel
tags: layers overlay picker toggle wind rain ais bathymetry currents mutex not yet
status: live
script: picker.sh
---
Overlay picker for every map layer (wind, sky, AIS, bathymetry, currents, cables, marks, ensembles, waves, POI, aircraft, satellites).

- **Reach:** Sisu Nav → **Layers** button (top of the map)
- **Action:** toggle overlays; grey rows say **not yet** or **one at a time (off X first)** for mutex groups (particles, ensembles, bathy-relief).
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running
- **Expect:** Fresh browser: AIS, weather wind and wind-discrepancy on; choices saved per browser.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Layers`) · `sisu-nav/web/src/plugins/map/layers.ts`
