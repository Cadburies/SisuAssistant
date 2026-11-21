---
title: Sisu Nav › Map base
id: nav/charts/basemap
kind: panel
tags: charts map sheet base stack basemap osm openstreetmap esri satellite mapbox google azure imagery opacity
status: live
script: basemap.sh
order: 50
---
Base is a stack, not one choice. One product family appears once with **Live / Saved / USB** chips; **Auto** picks the primary. **+ stack** adds another base above it with its own opacity and order. Satellite + raster nautical + Poseidon + depth contours can coexist. The full Downloads list still has the area selection and export check.

- **Reach:** Sisu Nav → **Layers** → **Base**; the sidebar **Charts** panel is the summary
- **Action:** pick a chip for the primary; **+ stack** for an extra base; adjust opacity/order in **Base stack**.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for live imagery; keys for Mapbox/Google/Azure
- **Expect:** Live/harvest/USB chips per family. A manual satellite set is an offline base; a nautical raster can also be raised over a satellite from Overlays. Poseidon Nav/Sonar starts at z10, S-57 at z7, S-57 detail at z8 (or a higher `zoom-profile.json` floor); below that the base chart shows. A generated `<variant> overview` archive is a separate all-zoom choice (`Nautical Chart overview`, etc.), z0–8, and does not replace the source archive. Unclassified imports appear under **Unsorted manual** with the reason. Gold file boxes appear only with Overlays → Saved chart coverage on. Poseidon export check is in Downloads.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Map sources`, `## Charts`) · `sisu-nav/CHARTS.md` (`## Poseidon z0–8 overview`) · `sisu-nav/tools/poseidon-overview/` · `sisu-nav/web/src/plugins/map/basemap.ts` · `sisu-nav/web/src/plugins/map/availability.ts` · `sisu-nav/web/src/plugins/map/poseidonZoomProfile.ts` · `sisu-nav/web/src/plugins/layers/MapSheet.tsx` · `sisu-nav/web/src/plugins/harvest/ExportCheck.tsx`
