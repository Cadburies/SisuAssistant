---
title: Sisu › Live status
id: ha/sisu/live-status
kind: card
tags: live status house bank charging alternator board solar watermaker fresh black water fuel genset anchor battery runtime load time to 20 10 soc
status: live
script: live-status.sh
---
At-a-glance tiles: house bank, charging, combined alternator current, both alternator boards online, solar, watermaker, tank levels, genset and anchor alarm, plus the battery runtime (net load W/A and time to 20% / 10% SoC).

- **Reach:** HA → **Sisu** → section **Live status** · `http://192.168.0.20:8123/lovelace/default_view`
- **Action:** display only; tap a tile for its history.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** House bank like `13.21 V (74%)` and solar in W; battery runtime shows the 10-minute mean load and `5 h 40 min (≈ 03:15)` to 20% / 10%, `Charging` while the bank takes current, `—` when idle or already below the target; alternator and tank tiles read `unavailable` until the Marine Boards are on the LAN (#11, #2); Genset `off` (board not fitted).
- **Source:** `homeassistant/ui-lovelace.yaml` (`title: Live status`) · `homeassistant/packages/alternator_helpers.yaml` · `homeassistant/packages/energy_victron_stubs.yaml` (`sisu_house_load`, `sisu_time_to_20_soc`)
