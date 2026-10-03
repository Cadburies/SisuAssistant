---
title: Sisu Nav › Bathymetry
id: nav/bathy/panel
kind: panel
tags: bathymetry depth relief hillshade contours bluetopo gebco seascape emodnet gmrt maptiler
status: live
script: panel.sh
order: 56
---
Seafloor relief, hillshade, and contours for this view. Not a basemap, and not for navigation.

- **Reach:** Sisu Nav → **Charts** → **Depth** (on/off stays in Layers)
- **Action:** pick a source or **Pin source**, then download this view. **Show relief** turns the overlay on after a download.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet to fetch tiles
- **Expect:** The line follows the view. BlueTopo stays behind Seascape where the coverage sample is empty.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Charts`) · `sisu-nav/web/src/plugins/bathy/` · `sisu-nav/web/src/plugins/harvest/DepthBlock.tsx`
