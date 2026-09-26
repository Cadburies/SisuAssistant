---
title: Freezer › Temperature history (24 h)
id: ha/freezer/history
kind: card
tags: freezer temperature history graph 24h trend
status: live
script: history.sh
---
24-hour temperature graph for spotting defrosts, door-open events or compressor faults.

- **Reach:** HA → **Freezer** → history card · `http://192.168.0.20:8123/lovelace-freezer/main`
- **Action:** display only; hover for values.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** A saw-tooth line as the compressor cycles; gaps when the controller was offline.
- **Source:** `homeassistant/dashboards/freezer.yaml` (`history-graph`)
