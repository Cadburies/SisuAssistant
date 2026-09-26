---
title: Water › Autorun & watermaker controls
id: ha/water/autorun
kind: control
tags: watermaker autorun smart start stop flush cancel liters hours auto stop full
status: live
script: autorun.sh
---
Run the watermaker from HA: choose litres or hours, set the amount, auto-stop when tanks are full, and start/stop/flush buttons.

- **Reach:** HA → **Water** → section **Autorun** · `http://192.168.0.20:8123/lovelace-water/main`
- **Action:** **Autorun (smart)** starts a run sized to the tank shortfall (or 400 L); **Autorun** runs the set amount; **Stop** stops; **Freshwater flush** / **Cancel flush** control the fresh-water flush. ⚠️ Real machine — every start/stop ends with a fresh-water flush.
- **Needs:** Spectra reachable at .25, sea cock open, someone aboard · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Recommended litres shown (e.g. `400 L`); after a start the status tiles switch to running within a minute; after stop, a flush follows.
- **Source:** `homeassistant/dashboards/water.yaml` (`title: Autorun`) · `homeassistant/packages/spectra_newport.yaml` · `homeassistant/docs/SpectraControl.md`
