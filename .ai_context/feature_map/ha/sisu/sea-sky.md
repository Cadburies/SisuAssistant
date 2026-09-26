---
title: Sisu › Sea & sky
id: ha/sisu/sea-sky
kind: card
tags: depth tide station high low tide air water temperature wind aws sunrise sunset moonrise moonset
status: live
script: sea-sky.sh
---
Tiles for depth, nearest tide station and next high/low tide, air and water temperature, apparent wind (now and 6 h max), sun and moon rise/set.

- **Reach:** HA → **Sisu** → section **Sea & sky** · `http://192.168.0.20:8123/lovelace/default_view`
- **Action:** display only; tap a tile for its history.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Live depth and wind from the NMEA gateway; tide times read like `14:45 (in 4h 13m)`; AWS max (6h) can show `unknown` shortly after an HA restart. Known issue #162: with YDWG down, depth/wind/temps can show a stale last value.
- **Source:** `homeassistant/ui-lovelace.yaml` (`title: Sea & sky`) · `homeassistant/packages/marine_environment.yaml`
