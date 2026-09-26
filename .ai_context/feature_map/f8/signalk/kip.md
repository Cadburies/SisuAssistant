---
title: Signal K › KIP instrument panel
id: f8/signalk/kip
kind: page
tags: kip instrument dashboard gauges wind speed depth signal k webapp
status: live
script: kip.sh
---
KIP web app: configurable instrument gauges (wind, speed, depth, heading) driven by Signal K — good on a tablet at the helm.

- **Reach:** Browser on Sisu → `http://192.168.0.21:3000/@mxtommy/kip/`
- **Action:** add/arrange gauges per page; settings stored per browser.
- **Needs:** on the boat's Sisu Wi-Fi/LAN
- **Expect:** Gauges animate with live data; values freeze at the last reading if the NMEA feed goes silent (Signal K keeps the last value).
- **Source:** `homeassistant/signalk/plugin-config-data/``kip.json` · `homeassistant/signalk/settings.json`
