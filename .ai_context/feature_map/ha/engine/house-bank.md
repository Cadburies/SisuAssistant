---
title: Engine room › House bank (BMS)
id: ha/engine/house-bank
kind: card
tags: house bank bms soc voltage current power time to go consumed
status: live
script: house-bank.sh
---
SoC gauge plus BMS alarm, voltage, current, power, state, time-to-go and consumed Ah.

- **Reach:** HA → **Engine** → section **House Bank (BMS)** · `http://192.168.0.20:8123/lovelace-engine/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** SoC %, voltage ~13 V, consumed Ah counting since last full; time-to-go `unavailable` while charging.
- **Source:** `homeassistant/dashboards/engine.yaml` (`title: House Bank`) · `homeassistant/packages/victron_gx.yaml`
