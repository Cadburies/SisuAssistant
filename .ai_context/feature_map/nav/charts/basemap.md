---
title: Sisu Nav › Charts basemap
id: nav/charts/basemap
kind: panel
tags: charts basemap osm openstreetmap esri satellite mapbox google azure imagery
status: live
script: basemap.sh
order: 50
---
Charts lists Live streams, then Harvested cache for this view, then Downloaded imports. A saved row does not paint the live stream underneath.

- **Reach:** Sisu Nav → right stack → **Charts**
- **Action:** pick a row. A family count expands to the areas in this view; one area paints alone.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for live imagery; keys for Mapbox/Google/Azure
- **Expect:** Live, Harvested, then Downloaded. Bing, ArcGIS, and Google satellite stay on their own downloaded rows. The selected row outlines its boxes.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Charts`) · `sisu-nav/web/src/plugins/map/basemap.ts` · `sisu-nav/web/src/plugins/basemaps/`
