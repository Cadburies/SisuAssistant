---
title: Sisu › Ship zones (shortcuts)
id: ha/sisu/ship-zones
kind: control
tags: ship zones shortcuts navigation engine alternators power water helm sisu nav weather sources saloon
status: live
script: ship-zones.sh
---
Button grid that jumps to every other dashboard and to the Sisu Nav chart app.

- **Reach:** HA → **Sisu** → section **Ship zones** · `http://192.168.0.20:8123/lovelace/default_view`
- **Action:** tap **Engine / Alternators / Power / Water / Helm / Weather TWD / Sources** → opens that dashboard; **Sisu Nav** → opens `http://192.168.0.21:8088`; **Saloon** → opens the Water dashboard.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Each tap lands on the named dashboard; Sisu Nav opens in the browser (needs the F8 server up). Saloon's target is under review (#166).
- **Source:** `homeassistant/ui-lovelace.yaml` (`title: Ship zones`)
