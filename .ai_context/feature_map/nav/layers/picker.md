---
title: Sisu Nav › Layers picker
id: nav/layers/picker
kind: panel
tags: layers map sheet overlay base downloads picker toggle wind rain ais bathymetry currents one-of not yet
status: live
script: picker.sh
order: 40
---
One **Map sources** sheet (Base / Overlays / Downloads) for every chart and layer action. Overlays are grouped Sea floor, Nautical chart, Weather, Traffic, Safety, Places, Reference with active counts; one-of groups switch in one click. Nautical chart carries the Poseidon detail preset and variant; Sea floor carries the source selector and pin.

- **Reach:** Sisu Nav → **Layers** button (top of the map) → **Overlays**
- **Action:** toggle overlays. Grey rows say **not yet**; the old **off X first** mutex dead end is gone.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running
- **Expect:** Fresh browser: **Navigation** detail, AIS, weather wind and wind-discrepancy on; choices saved per browser. The Detail select has **Auto** (Overview/Coastal/Approach/Harbor by zoom) plus the manual presets; a manual choice freezes it, and editing a chart group shows **Custom**. Poseidon source/layer floors are shown in the Nautical chart section. Overlay colours come from `sisu-nav/web/src/plugins/map/chartPalette.ts`, derived from the Poseidon export (#252).
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Map sources`) · `sisu-nav/web/src/plugins/map/layers.ts` · `sisu-nav/web/src/plugins/map/poseidonZoomProfile.ts` · `sisu-nav/web/src/plugins/layers/MapSheet.tsx`
