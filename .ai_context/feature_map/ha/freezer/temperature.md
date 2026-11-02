---
title: Freezer › Temperature & setpoint
id: ha/freezer/temperature
kind: control
tags: freezer temperature setpoint thermostat target
status: live
script: temperature.sh
---
Current freezer temperature gauge and the thermostat to set the target.

- **Reach:** HA → **Freezer** → section **Temperature** · `http://192.168.0.20:8123/lovelace-freezer/main`
- **Action:** drag/tap the **Setpoint** thermostat. The target is −30 °C to +20 °C in 1 °C steps, with freeze at −5 °C and fridge at 4 °C.
- **Needs:** freezer controller online · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Temperature near the target when running; entities `unavailable` if the controller is offline.
- **Source:** `homeassistant/dashboards/freezer.yaml` (`title: Temperature`) · `homeassistant/esphome/freezer_marineboard.yaml`
