---
title: Alternators › BMS / pack
id: ha/alternators/bms
kind: card
tags: bms battery soc alarm victron pack charge authority
status: live
script: bms.sh
---
Victron BMS state, battery SoC, alarm and alarm detail — the BMS stays the charge authority over the alternators.

- **Reach:** HA → **Alternators** → section **BMS / Pack** · `http://192.168.0.20:8123/lovelace-alternators/overview`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** BMS state like `charging`, SoC in %, alarm `off`, detail `none` in normal operation.
- **Source:** `homeassistant/dashboards/alternators.yaml` (`title: BMS / Pack`) · `homeassistant/packages/victron_gx.yaml`
