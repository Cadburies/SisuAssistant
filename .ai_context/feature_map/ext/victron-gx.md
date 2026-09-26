---
title: Victron Color Control / GX
id: ext/victron-gx
kind: device
tags: victron gx color control cerbo mqtt battery solar inverter bms
status: unverified
script: victron-gx.sh
---
Victron GX: battery, BMS, solar chargers and inverter data via its MQTT broker; the BMS remains charge authority.

- **Reach:** Device at `192.168.10.32` (MQTT 1883; VRM/Remote Console on the GX)
- **Action:** none from HA except reading; settings on the GX itself.
- **Needs:** on the boat LAN; GX powered · `ColorControlIP` secret
- **Expect:** MQTT 1883 answers and HA's Victron source is on. Observed offline from ~14:40 UTC 2026-09-26 (#172).
- **Source:** `homeassistant/packages/victron_gx.yaml` · `homeassistant/python_scripts/victron_gx.py`
