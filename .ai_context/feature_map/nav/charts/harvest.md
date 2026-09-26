---
title: Sisu Nav › Offline harvest
id: nav/charts/harvest
kind: control
tags: harvest offline tiles download mbtiles noaa satellite estimate jobs resume
status: live
script: harvest.sh
---
Download tiles of the current view for offline use: provider, tile-count estimate, **Start**, and a resumable Jobs list.

- **Reach:** Sisu Nav → **Charts** → pick a harvest provider → **Start**
- **Action:** **Start** queues a job; **Resume** continues an interrupted one; paid providers ask for a key (**Save on server**).
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers
- **Expect:** Jobs list shows progress and `filled N`; `filled 0 — none landed` if nothing arrived.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Charts`) · `sisu-nav/api/harvest/` · `sisu-nav/api/providers.yaml` · `sisu-nav/web/src/plugins/harvest/`
