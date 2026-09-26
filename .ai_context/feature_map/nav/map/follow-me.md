---
title: Sisu Nav › Follow me
id: nav/map/follow-me
kind: control
tags: follow me gps device position pan map https
status: live
script: follow-me.sh
---
Pans the map to **this device's** GPS (not the boat's AIS/Signal K position).

- **Reach:** Sisu Nav → map, top-left **Follow me**
- **Action:** tap to follow; tap again to stop.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; HTTPS or localhost (plain HTTP on the LAN cannot read device GPS)
- **Expect:** Over plain `http://192.168.0.21:8088` the browser refuses location — expected; the gold boat icon still shows the boat.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Layout`) · `sisu-nav/web/src/plugins/map/`
