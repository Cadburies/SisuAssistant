---
title: Sisu Nav › Route planner
id: nav/route/planner
kind: control
tags: route planner isochrone polar eta model agreement ensemble commit signal k
status: live
script: planner.sh
---
Isochrone routing between two points using the boat's polar and forecast wind; three modes (fastest, model agreement, ensemble agreement).

- **Reach:** Sisu Nav → right stack → **Route** panel
- **Action:** **pick start/destination** on the map → choose mode → **Plan**; **Commit** saves the route to Signal K (needs SK login).
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers; Signal K login to commit
- **Expect:** Drawn track with ETA; committed routes appear in Signal K / Freeboard. Advisory only — check against the chart.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Route`) · `sisu-nav/api/route/`
