---
title: Sisu Nav › Wind roses
id: nav/roses/wind-roses
kind: layer
tags: wind roses history influx sisu 1m month season community share anchor spot anchorage sisumate
status: live
script: wind-roses.sh
order: 74
---
Historical wind roses from this boat's own logged wind (InfluxDB `Sisu_1m`), a rose per anchor spot (auto-detected, synced to SisuMate), plus an opt-in community map.

- **Reach:** Sisu Nav → **Layers** (top of map) → **Wind roses** → **Roses** panel
- **Action:** pick last N days / N months / month-of-year; click a rose cell for samples; **Share** opts in to the community map. Source **Anchor spots** → spot list / click a spot for steadiness, swing, hours; **Detect now**; **Include marinas & slips** (bow line + wind on bow/beam/stern).
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running
- **Expect:** Roses per map cell from `Sisu_1m` (1-minute rollup, filled since 2026-09-26 — longer windows grow as data accumulates).
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Wind roses`, `### Anchor spots`) · `sisu-nav/api/roses/` (`anchor*.mjs`, #187) · `homeassistant/influx-tasks/sisu_1m.flux` · `sisu-nav/web/src/plugins/roses/`
