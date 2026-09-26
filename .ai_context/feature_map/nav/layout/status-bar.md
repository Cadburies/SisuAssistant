---
title: Sisu Nav › Status bar, theme & Signal K login
id: nav/layout/status-bar
kind: control
tags: status bar signal k login sign in position sog night day theme
status: live
script: status-bar.sh
order: 10
---
Bottom bar: Signal K connection, position, SOG, ☾ Night / ☀ Day theme toggle and the Signal K sign-in control.

- **Reach:** Sisu Nav (`http://192.168.0.21:8088`) → bottom of the screen
- **Action:** **Signal K login** → enter SK username/password (needed for Windex/Instruments/Notes); **☾/☀** toggles theme (saved per browser).
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; Signal K credentials
- **Expect:** Logged in: `connected`, position and SOG update; logged out: live panels blank.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Layout`)
