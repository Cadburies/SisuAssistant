---
title: Sisu › Ship zones
id: ha/sisu/ship-zones
kind: control
tags: ship zones navigation engine alternators power water helm weather sources saloon
status: live
script: ship-zones.sh
---
Button grid that jumps to every other dashboard (F8 web UIs incl. Sisu Nav are under Shortcuts).

- **Reach:** HA → **Sisu** → section **Ship zones** · `http://192.168.0.20:8123/lovelace/default_view`
- **Action:** tap **Engine / Alternators / Power / Water / Helm / Weather TWD / Sources** → opens that dashboard; **Saloon** → opens the Water dashboard.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Each tap lands on the named dashboard; Saloon's target is under review (#166).
- **Source:** `homeassistant/ui-lovelace.yaml` (`title: Ship zones`)
