---
title: Sisu Nav › Bathymetry
id: nav/bathy/panel
kind: panel
tags: bathymetry depth relief hillshade contours bluetopo gebco seascape emodnet gmrt maptiler
status: live
script: panel.sh
---
Seafloor relief/contour sources (BlueTopo, GEBCO, EMODnet, GMRT, Esri Ocean, MapTiler Ocean, Seascape) harvested like charts. Not for navigation.

- **Reach:** Sisu Nav → right stack → **Bathymetry** panel (Layers → Bathymetry relief/hillshade/Depth contours)
- **Action:** pick a source (or **Pin source**), harvest the view; the matching overlay turns on.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers
- **Expect:** Hint line follows the view (“US waters — BlueTopo available” / “Outside NOAA — Seascape / GEBCO”); filled jobs show as relief.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Bathymetry`) · `sisu-nav/web/src/plugins/bathy/`
