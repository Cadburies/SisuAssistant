---
title: Sisu Nav › Wind roses
id: nav/roses/wind-roses
kind: layer
tags: wind roses history influx sisu 1m month season community share
status: broken
script: wind-roses.sh
---
Historical wind roses from this boat's own logged wind (InfluxDB `Sisu_1m`), plus an opt-in community map.

- **Reach:** Sisu Nav → **Layers** (top of map) → **Wind roses** → **Roses** panel
- **Action:** pick last N days / N months / month-of-year; click a rose cell for samples; **Share** opts in to the community map.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running
- **Expect:** Roses per map cell. Currently broken: the API returns 502 because InfluxDB bucket `Sisu_1m` does not exist (#169).
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Wind roses`) · `sisu-nav/api/roses/` · `homeassistant/influx-tasks/sisu_1m.flux` · `sisu-nav/web/src/plugins/roses/`
