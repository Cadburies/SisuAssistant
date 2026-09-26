---
title: Engine room › Port engine
id: ha/engine/port-engine
kind: card
tags: port engine rpm coolant oil pressure alternator starter voltage load fuel rate boost hours alarm
status: live
script: port-engine.sh
---
Port engine data from Signal K (N2K): alarm, RPM, coolant, oil pressure, voltages, load, fuel rate, boost and hours.

- **Reach:** HA → **Engine** → section **Port Engine** · `http://192.168.0.20:8123/lovelace-engine/main`
- **Action:** display only.
- **Needs:** engine running and its N2K engine data reaching Signal K · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Values while the engine runs; `unavailable` with the engine off; alarm `off` and alarms `none` normally.
- **Source:** `homeassistant/dashboards/engine.yaml` (`title: Port Engine`) · `homeassistant/packages/signalk_engines.yaml`
