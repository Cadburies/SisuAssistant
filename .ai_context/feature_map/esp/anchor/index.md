---
title: Anchor tension (load cell)
id: esp/anchor
kind: device
tags: anchor tension load cell rode snubber peak reset
status: planned
script: index.sh
---
Planned load-cell device measuring anchor rode tension, with a peak-hold reset.

- **Reach:** Browser on Sisu → `http://192.168.10.46/` (reserved)
- **Action:** **Reset Anchor Tension Peak** clears the stored peak.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered; device flashed and the load cell fitted (#34)
- **Expect:** Not flashed yet — scripts SKIP.
- **Source:** `homeassistant/esphome/anchortension.yaml`
