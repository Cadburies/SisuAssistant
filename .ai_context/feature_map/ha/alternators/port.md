---
title: Alternators › Port gauges & setpoints
id: ha/alternators/port
kind: control
tags: port alternator current voltage temperature gauge setpoint absorption float field duty charge stage enable fault
status: unverified
script: port.sh
---
Port alternator: current, house voltage and temperature gauges with coloured bands, the user setpoints under each gauge, and a detail list (enable, stage, field duty, power, fault).

- **Reach:** HA → **Alternators** → section **Port** · `http://192.168.0.20:8123/lovelace-alternators/overview`
- **Action:** change the number under a gauge (current, absorption/float voltage, temperature) → sends a new **user setpoint** to the Port board. It can only lower targets inside the fixed hard limits (250 A / 14.4 V / 125 °C), which no dashboard can change.
- **Needs:** Port Marine Board online (#11) · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Gauges fill with live values and band colours; setpoint numbers match the board. Board offline → gauges and numbers `unavailable`; enable/fault rows missing until the board registers them.
- **Source:** `homeassistant/dashboards/alternators.yaml` (`title: Port`) · `homeassistant/esphome/packages/marine_alternator.yaml` · `homeassistant/docs/ALTERNATOR_LIMITS.md`
