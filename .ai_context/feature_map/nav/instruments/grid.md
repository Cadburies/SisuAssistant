---
title: Sisu Nav › Instruments
id: nav/instruments/grid
kind: panel
tags: instruments grid sog depth metrics cells rows signal k
status: live
script: grid.sh
---
Customisable grid of live Signal K metrics (SOG, depth, …).

- **Reach:** Sisu Nav → right stack → **Instruments** (edit via **Layout**)
- **Action:** in Layout edit mode: drag rows, add cells, add rows.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; Signal K login
- **Expect:** Cells update live; blank until signed in; frozen values if NMEA is stale (#162).
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Instruments`) · `sisu-nav/web/src/plugins/instruments/`
