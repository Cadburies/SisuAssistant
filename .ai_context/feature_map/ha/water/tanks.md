---
title: Water › Tanks
id: ha/water/tanks
kind: card
tags: tanks fresh water forward aft combined black grey fuel level volume litres
status: unverified
script: tanks.sh
---
Gauges for fresh water forward/aft/combined, black water and fuel, plus fresh volume, grey water and tanks-present flag.

- **Reach:** HA → **Water** → section **Tanks** · `http://192.168.0.20:8123/lovelace-water/main`
- **Action:** display only.
- **Needs:** levels Marine Board online (#2) · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Percentages and litres once the levels board is fitted; until then `unavailable` and tanks-present `off`.
- **Source:** `homeassistant/dashboards/water.yaml` (`title: Tanks`) · `homeassistant/esphome/waterlevels.yaml`
