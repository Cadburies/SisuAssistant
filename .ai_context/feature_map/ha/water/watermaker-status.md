---
title: Water › Watermaker status
id: ha/water/watermaker-status
kind: card
tags: watermaker spectra running autostore flush alarm product ppm status
status: live
script: watermaker-status.sh
---
Tiles for running, autostore countdown, flushing, alarm and product water quality (ppm).

- **Reach:** HA → **Water** → first section · `http://192.168.0.20:8123/lovelace-water/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** In storage: Autostore countdown like `Autostore : 6d 10h 13m`, flush/alarm `off`, product ppm `unavailable` (only measured while making water), Running `off` (page 10 Autostore is not running, #165). Running `on` only while starting/making water.
- **Source:** `homeassistant/dashboards/water.yaml` · `homeassistant/packages/spectra_newport.yaml` · `homeassistant/python_scripts/spectra_ws.py`
