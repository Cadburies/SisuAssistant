---
title: Signal K › Freeboard chart plotter
id: f8/signalk/freeboard
kind: page
tags: freeboard chart plotter map route waypoints ais signal k webapp
status: live
script: freeboard.sh
---
Freeboard-SK web chart plotter: own position, AIS targets, routes and waypoints stored in Signal K.

- **Reach:** Browser on Sisu → `http://192.168.0.21:3000/@signalk/freeboard-sk/`
- **Action:** create/activate routes (feeds the HA Helm › Route card), drop waypoints, view AIS.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; Signal K login to save routes
- **Expect:** Map centres on the boat; an activated route appears in HA Helm › Route within a poll.
- **Source:** `homeassistant/signalk/plugin-config-data/``freeboard-sk.json` · `homeassistant/signalk/plugin-config-data/``course-provider.json`
