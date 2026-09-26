---
title: Power › Alternators, loads & BMS
id: ha/power/loads
kind: card
tags: alternators combined power current ac dc loads inverter grid shore bms cell voltage
status: live
script: loads.sh
---
Lists for combined alternator output, AC/DC loads (grid, inverter, AC, DC) and BMS details incl. min/max cell voltage.

- **Reach:** HA → **Power** → section **Alternators & loads** · `http://192.168.0.20:8123/lovelace-power/system`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Inverter/AC load in W; grid `0 W` off shore power; alternator rows `unavailable` while the boards are offline; cell min/max may read `unavailable` if the BMS does not publish them.
- **Source:** `homeassistant/dashboards/power.yaml` (`title: Alternators & loads`) · `homeassistant/packages/victron_gx.yaml` · `homeassistant/packages/alternator_helpers.yaml`
