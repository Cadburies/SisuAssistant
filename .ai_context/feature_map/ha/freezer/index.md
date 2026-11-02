---
title: Freezer › Dashboard
id: ha/freezer
kind: dashboard
tags: freezer fridge aft cockpit temperature dashboard
status: live
script: index.sh
---
Aft-cockpit freezer: temperature, setpoint, compressor, firmware cut-out and battery voltage, with 24 h history.

- **Reach:** HA → sidebar **Freezer** · `http://192.168.0.20:8123/lovelace-freezer/main`
- **Action:** display plus the thermostat (see Temperature).
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Header `🧊 Freezer · Aft Cockpit` with current and target temperature. Protection and fault code appear here once firmware #221 has registered.
- **Source:** `homeassistant/dashboards/freezer.yaml` · `homeassistant/configuration.yaml` (`lovelace-freezer`)
