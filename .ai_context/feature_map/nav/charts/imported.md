---
title: Sisu Nav › Imported charts (USB / drop-in)
id: nav/charts/imported
kind: control
tags: import charts usb mbtiles pmtiles inbox folder offline
status: live
script: imported.sh
order: 54
---
Import chart archives you already have. They join the Charts list for views they cover, grouped by family.

- **Reach:** Copy files to the F8 inbox (`/data/import`) → Sisu Nav → **Charts** → **Add from USB**
- **Action:** pick folder and files, choose kind (nautical/satellite/bathymetry) → **Import selected**.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; files already in the inbox
- **Expect:** Nautical and satellite files show as one family row in this view. Bathymetry shows under Depth.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Imported charts`) · `sisu-nav/web/src/plugins/imported/`
