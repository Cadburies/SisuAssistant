---
title: Sisu Nav › Instruments
id: nav/instruments/grid
kind: panel
tags: instruments grid sog depth metrics cells rows signal k
status: live
script: grid.sh
order: 72
---
Customisable grid of live Signal K metrics (SOG, depth, …).

- **Reach:** Sisu Nav → right stack → **Instruments** (edit via **Layout**)
- **Action:** in Layout edit mode: drag rows, add cells, add rows.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; Signal K login
- **Expect:** Cells update live; blank until signed in; values freeze at the last reading if the NMEA feed goes silent (Signal K keeps the last value).
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Instruments`) · `sisu-nav/web/src/plugins/instruments/`
