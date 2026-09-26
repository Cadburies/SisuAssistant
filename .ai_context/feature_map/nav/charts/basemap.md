---
title: Sisu Nav › Charts basemap
id: nav/charts/basemap
kind: panel
tags: charts basemap osm openstreetmap esri satellite mapbox google azure imagery
status: live
script: basemap.sh
---
The basemap dropdown: live OpenStreetMap (default), Esri World Imagery, keyed Mapbox/Google/Azure imagery, harvested or imported sets.

- **Reach:** Sisu Nav → right stack → **Charts** → **Basemap**
- **Action:** pick one basemap; layers overlay it.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers; keys for Mapbox/Google/Azure
- **Expect:** Map redraws with the chosen tiles; keyed providers need their key in Settings.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Charts`) · `sisu-nav/web/src/plugins/basemaps/`
