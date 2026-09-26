---
title: Helm › Route (ETA & waypoints)
id: ha/helm/route
kind: card
tags: route eta arrival time-to-go distance next-waypoint course navigation helm
status: live
script: route.sh
---
Active Signal K route at a glance: status tile plus ETA, time to go, distance remaining, next waypoint, its distance and ETA.

- **Reach:** HA → sidebar **Helm** → grid **Route** (2nd grid, under the status chips) · `http://192.168.0.20:8123/lovelace-helm/main`
- **Action:** display only — no tap/hold actions.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; a route activated in Signal K (Freeboard, KIP or Sisu Nav › Route) · HA REST with `ha_token`.
- **Expect:** *Active route* shows the route name; values refresh each poll. No route → *Active route* = `No active route`, the six sensors `unavailable`.
- **Source:** `homeassistant/dashboards/helm.yaml` (`title: Route`) · `homeassistant/packages/signalk_course.yaml`
