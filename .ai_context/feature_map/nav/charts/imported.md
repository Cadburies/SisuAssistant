---
title: Sisu Nav › Imported charts (USB / drop-in)
id: nav/charts/imported
kind: control
tags: import charts usb mbtiles pmtiles inbox folder offline
status: live
script: imported.sh
order: 54
---
Zone folders named place-product-date are classified by content, not by the folder: satellite/aerial → Base; nautical raster → Base and optional chart overlay; bathymetry/DEM/contours and Navionics SonarChart/Live Sonar → Sea floor; Poseidon → Nautical chart variant; unknown → **Unsorted manual** with the reason.

- **Reach:** Files already in F8 `tiles/manual/`, or inbox (`/data/import`) → Sisu Nav → **Layers** → **Downloads** → **Add from USB**
- **Action:** **Import all in this folder** for a mixed drop. **Import selected** checks a subset. The kind dropdown is only a fallback when the name does not say.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; keep names like `place-navionics-yyyy-mm`, `bingsat`, `arcgis`, `googlesat`, or drop a Navionics folder (`T08`, `T32`, `MBM`, `lsc`)
- **Expect:** Bing, ArcGIS, and Google satellite are Base chips. A Navionics folder is one inbox row and becomes `navionics-sonarchart` (Sea floor), `navionics-s57`/`navionics-nautical` (Base), and `navionics-live-sonar` (Sea floor) for that month. Imported bathymetry appears under Sea floor; imported nautical can be raised with opacity under Nautical chart. Unknown items stay under **Unsorted manual**.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Imported charts`) · `sisu-nav/api/harvest/navionics.mjs` · `sisu-nav/web/src/plugins/map/sources.ts` · `sisu-nav/web/src/plugins/imported/`
