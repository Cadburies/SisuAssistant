---
title: Spectra Newport 400c watermaker
id: ext/spectra
kind: device
tags: spectra watermaker newport 400c controller web ui touch screen
status: live
script: spectra.sh
---
Spectra watermaker controller on the LAN; HA drives it through its WebSocket UI.

- **Reach:** Browser on Sisu → `http://192.168.0.25/` (or HA › Water › Spectra web UI)
- **Action:** anything the Spectra touch screen can do.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; watermaker powered
- **Expect:** Controller page loads; status matches HA's Water dashboard (see #165 for the running flag).
- **Source:** `homeassistant/docs/SpectraControl.md` · `homeassistant/python_scripts/spectra_ws.py`
