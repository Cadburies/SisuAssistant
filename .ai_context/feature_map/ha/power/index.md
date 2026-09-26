---
title: Power › Dashboard
id: ha/power
kind: dashboard
tags: power electrical battery solar victron dashboard
status: live
script: index.sh
---
Electrical overview: house bank gauges, three solar chargers, alternators, AC/DC loads, BMS, and a power-flow view.

- **Reach:** HA → sidebar **Power** (or Sisu › Ship zones › Power) · `http://192.168.0.20:8123/lovelace-power/system`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Header line like `House 13.21 V (74%) · Alts 0.0 A`; tabs **System** and **Flows**.
- **Source:** `homeassistant/dashboards/power.yaml` · `homeassistant/configuration.yaml` (`lovelace-power`)
