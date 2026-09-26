---
title: Power › House battery gauges
id: ha/power/battery
kind: card
tags: battery soc voltage current house bank gauge victron
status: live
script: battery.sh
---
Three gauges for the house bank: state of charge, voltage and current (positive = charging).

- **Reach:** HA → **Power** → first section · `http://192.168.0.20:8123/lovelace-power/system`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** SoC in %, voltage around 13 V, current positive while solar/alternators charge and negative under load.
- **Source:** `homeassistant/dashboards/power.yaml` · `homeassistant/packages/victron_gx.yaml`
