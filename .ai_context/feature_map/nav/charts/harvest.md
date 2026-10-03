---
title: Sisu Nav › Offline harvest
id: nav/charts/harvest
kind: control
tags: harvest offline tiles download mbtiles noaa satellite estimate jobs resume
status: live
script: harvest.sh
order: 52
---
Download the chart on screen. Keep filling as you pan is per source, and only while that chart is showing.

- **Reach:** Sisu Nav → **Charts** → the chart on screen → **Download the rest**
- **Action:** **Download the rest** queues a job. **Jobs** resumes an interrupted one. A missing key asks for **Save on server**.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet to fetch tiles
- **Expect:** The line names the source and how many tiles are still missing. Jobs show `filled N`, or `filled 0 — none landed`.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Charts`) · `sisu-nav/api/harvest/` · `sisu-nav/api/providers.yaml` · `sisu-nav/web/src/plugins/harvest/`
