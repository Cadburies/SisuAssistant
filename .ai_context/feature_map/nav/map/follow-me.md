---
title: Sisu Nav › Follow me
id: nav/map/follow-me
kind: control
tags: follow me gps device position pan map https
status: live
script: follow-me.sh
order: 30
---
Pans the map to this device's GPS. On the boat that page is https://192.168.0.21:8443.

- **Reach:** Sisu Nav → map, top-left **Follow me**. From plain HTTP, use the link **Open the secure page**
- **Action:** accept the certificate warning once, allow location, then tap to follow. Tap again to stop.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; the secure page, then the browser location prompt
- **Expect:** The map centers on this device. The gold boat stays the boat. Plain HTTP explains why and links to the secure page.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Layout`) · `sisu-nav/web/src/plugins/map/`
