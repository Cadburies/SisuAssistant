---
title: Water › Dashboard
id: ha/water
kind: dashboard
tags: water watermaker spectra tanks fresh black fuel dashboard saloon
status: live
script: index.sh
---
Water dashboard: Spectra watermaker status and controls, tank levels, autorun and the Spectra's own web UI.

- **Reach:** HA → sidebar **Water** (or Sisu › Ship zones › Water / Saloon) · `http://192.168.0.20:8123/lovelace-water/main`
- **Action:** display plus watermaker controls (see Autorun).
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Header `Water · Spectra Newport 400c` with the current Spectra status (e.g. `Autostore : 6d 10h`).
- **Source:** `homeassistant/dashboards/water.yaml` · `homeassistant/configuration.yaml` (`lovelace-water`)
