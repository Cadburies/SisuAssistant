---
title: Sisu Nav › App
id: nav
kind: app
tags: sisu nav chart plotter cockpit map app 8088 advisory
status: live
script: index.sh
---
Browser chart cockpit on the F8: map with overlays, a right-hand stack of panels, and a status bar. Advisory only — no autopilot link.

- **Reach:** Browser on Sisu → `http://192.168.0.21:8088` (or HA › Sisu › Ship zones › **Sisu Nav**)
- **Action:** opens the map; see Layers, Charts and the panel stack.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running
- **Expect:** Map loads centred on the boat; status bar shows Signal K state, position and SOG.
- **Source:** `sisu-nav/USER_GUIDE.md` · `sisu-nav/api/server.mjs`
