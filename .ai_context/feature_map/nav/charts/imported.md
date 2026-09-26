---
title: Sisu Nav › Imported charts (USB / drop-in)
id: nav/charts/imported
kind: control
tags: import charts usb mbtiles pmtiles inbox folder offline
status: live
script: imported.sh
---
Import chart archives you already have (`.mbtiles`, `.pmtiles`, XYZ folders) from the inbox; they appear in the Basemap dropdown.

- **Reach:** Copy files to the F8 inbox (`/data/import`) → Sisu Nav → **Imported** panel
- **Action:** pick folder and files, choose kind (nautical/satellite/bathymetry) → **Import selected**.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; files already in the inbox
- **Expect:** Inbox shows as mounted; imported sets list and appear under Charts → Basemap.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Imported charts`) · `sisu-nav/web/src/plugins/imported/`
