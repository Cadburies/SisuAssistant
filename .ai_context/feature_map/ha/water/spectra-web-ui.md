---
title: Water › Spectra web UI
id: ha/water/spectra-web-ui
kind: page
tags: spectra web ui controller iframe watermaker native pages
status: live
script: spectra-web-ui.sh
---
The Spectra controller's own web pages embedded in the dashboard.

- **Reach:** HA → **Water** → section **Spectra web UI** · `http://192.168.0.20:8123/lovelace-water/main` (direct: `http://192.168.0.25/`)
- **Action:** everything the Spectra touch screen can do, via its own UI.
- **Needs:** on the boat LAN (the Spectra is at 192.168.0.25) · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** The Spectra's page loads inside the card; blank if the unit is powered off.
- **Source:** `homeassistant/dashboards/water.yaml` (`type: iframe`) · `homeassistant/docs/SpectraControl.md`
