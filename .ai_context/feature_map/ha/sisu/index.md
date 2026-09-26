---
title: Sisu › Vessel board
id: ha/sisu
kind: dashboard
tags: sisu home overview vessel board main dashboard start
status: live
script: index.sh
---
The main Home Assistant board for Sisu: header, sea & sky, source health, live status, cameras and shortcuts to every other dashboard.

- **Reach:** HA → sidebar **Sisu** (the default board) · `http://192.168.0.20:8123/lovelace/default_view`
- **Action:** display plus navigation tiles (see Ship zones).
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Opens on the Sisu view; a second view **Cameras** is in the top tab bar.
- **Source:** `homeassistant/ui-lovelace.yaml` · `homeassistant/configuration.yaml` (`lovelace:`)
