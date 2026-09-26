---
title: Sisu › Header & forecast
id: ha/sisu/welcome
kind: card
tags: header date time house bank charge summary weather forecast
status: live
script: welcome.sh
---
Top card: date/time, house bank voltage and SoC, alternator charge summary, and the local weather forecast.

- **Reach:** HA → **Sisu** → first card at the top · `http://192.168.0.20:8123/lovelace/default_view`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Line like `Sisu Sat 26 Sep · 10:30 · House 13.2 V (74%) · Port offline · Stbd offline`; forecast card below with today and coming days.
- **Source:** `homeassistant/ui-lovelace.yaml` (`## Sisu`) · `homeassistant/packages/alternator_helpers.yaml`
