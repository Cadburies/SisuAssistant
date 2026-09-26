---
title: Engine room › Dashboard
id: ha/engine
kind: dashboard
tags: engine room machinery alternators genset engines dashboard
status: live
script: index.sh
---
Machinery dashboard: alternators, firmware diagnostics, both engines, house bank and the (future) genset.

- **Reach:** HA → sidebar **Engine** (or Sisu › Ship zones › Engine) · `http://192.168.0.20:8123/lovelace-engine/main`
- **Action:** tap **Full alternator detail** → opens the Alternators dashboard.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Header `Engine room — Alternators · genset · machinery`; with both boards offline it says so instead of the charge summary.
- **Source:** `homeassistant/dashboards/engine.yaml` · `homeassistant/configuration.yaml` (`lovelace-engine`)
