---
title: Sisu Nav › Imported charts (USB / drop-in)
id: nav/charts/imported
kind: control
tags: import charts usb mbtiles pmtiles inbox folder offline
status: live
script: imported.sh
order: 54
---
Zone folders named place-product-date join the chart for that product, and Import all reads the product word for the kind.

- **Reach:** Files already in F8 `tiles/manual/`, or inbox (`/data/import`) → Sisu Nav → **Charts** → **Add from USB**
- **Action:** **Import all in this folder** for a mixed drop. **Import selected** checks a subset. The kind dropdown applies when the name does not say.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; keep names like `place-navionics-yyyy-mm`, `bingsat`, `arcgis`, `googlesat`, or drop a Navionics folder (`T08`, `T32`, `MBM`, `lsc`)
- **Expect:** Bing, ArcGIS, and Google satellite are their own Downloaded rows. Navionics Live Sonar is its own row when the view overlaps its tiles. A Navionics folder is one inbox row and becomes `navionics-sonarchart`, `navionics-s57`, `navionics-nautical`, and `navionics-live-sonar` for that month. Only Live Sonar is drawn. Bathymetry shows under Depth.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Imported charts`) · `sisu-nav/api/harvest/navionics.mjs` · `sisu-nav/web/src/plugins/imported/`
