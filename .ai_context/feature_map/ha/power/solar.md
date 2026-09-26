---
title: Power › Solar (3× MPPT)
id: ha/power/solar
kind: card
tags: solar mppt roof forward mid aft yield today charger state
status: live
script: solar.sh
---
Per-array solar power (roof forward, roof mid, aft), total, today's yield and charger state.

- **Reach:** HA → **Power** → section **Solar (3× MPPT)** · `http://192.168.0.20:8123/lovelace-power/system`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Watts per array summing to the total; yield in kWh growing through the day; state `bulk`/`absorption`/`float` by day, `off` at night.
- **Source:** `homeassistant/dashboards/power.yaml` (`title: Solar`) · `homeassistant/packages/victron_gx.yaml`
