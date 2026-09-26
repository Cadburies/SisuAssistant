---
title: Sisu Nav › Backend API
id: nav/api/routes
kind: route
tags: sisu nav api routes health config tilesets harvest weather marine roses route
status: live
script: routes.sh
audience: agent
---
The `sisu-nav-api` HTTP API behind the panels: `/api/health`, `/api/config`, tilesets, harvest, weather, marine, ensemble, roses, route, POIs, hazards, aircraft, satellites, AIS.

- **Reach:** `http://192.168.0.21:8088/api/<feature>/…` (route table in `sisu-nav/api/server.mjs`)
- **Action:** GET/POST per route; see DEVELOPER.md.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running
- **Expect:** `/api/health` → `{"ok":true}`. Unknown `/api/…` paths return a JSON 404 `{"error":"unknown api route"}`.
- **Source:** `sisu-nav/api/server.mjs` · `sisu-nav/DEVELOPER.md`
