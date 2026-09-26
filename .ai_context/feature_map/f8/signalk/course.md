---
title: Signal K › Course & route API
id: f8/signalk/course
kind: route
tags: signal k course api route active waypoint eta provider
status: live
script: course.sh
audience: agent
---
Course-provider plugin: active route, next waypoint and ETA — read by HA's Helm › Route card.

- **Reach:** `http://192.168.0.21:3000/signalk/v2/api/vessels/self/navigation/course`
- **Action:** set/clear the active route from Freeboard or Sisu Nav; HA polls it.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · Signal K login
- **Expect:** No route: course empty and HA shows `No active route`; with a route: next point and ETA filled.
- **Source:** `homeassistant/signalk/plugin-config-data/``course-provider.json` · `homeassistant/packages/signalk_course.yaml`
