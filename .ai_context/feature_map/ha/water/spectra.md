---
title: Water › Spectra pressures & quality
id: ha/water/spectra
kind: card
tags: spectra feed boost pressure filter condition product ppm gauges
status: live
script: spectra.sh
---
Gauges for feed pressure, filter condition and product quality, plus a list with boost pressure and autostore.

- **Reach:** HA → **Water** → section **Spectra** · `http://192.168.0.20:8123/lovelace-water/main`
- **Action:** display only.
- **Needs:** watermaker running (values only exist while making water) · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** While running: feed/boost in bar, filter %, product ppm (lower is better). Idle: `unavailable`.
- **Source:** `homeassistant/dashboards/water.yaml` (`title: Spectra`) · `homeassistant/packages/spectra_newport.yaml` · `homeassistant/docs/SpectraControl.md`
