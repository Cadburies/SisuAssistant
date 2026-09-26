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
- **Action:** drag/tap the **Setpoint** thermostat → changes the target temperature on the freezer controller.
- **Needs:** freezer controller online · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Temperature well below 0 °C and near the target when running; entities `unavailable` if the controller is offline.
- **Source:** `homeassistant/dashboards/freezer.yaml` (`title: Temperature`) · `homeassistant/esphome/freezer.yaml`
