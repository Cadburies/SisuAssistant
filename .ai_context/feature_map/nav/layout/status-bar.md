---
title: Sisu Nav › Status bar, theme & Signal K login
id: nav/layout/status-bar
kind: control
tags: status bar signal k login sign in position sog night day theme
status: live
script: status-bar.sh
order: 10
---
Bottom bar: Signal K connection, position, SOG, and the ☾ Night / ☀ Day theme toggle. The boat account signs in on its own.

- **Reach:** Sisu Nav (`http://192.168.0.21:8088`) → bottom of the screen
- **Action:** None for a normal open. If the boat sign-in fails, enter the Signal K username and password. **☾/☀** toggles theme (saved per browser).
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; `SignalKUser` and `SignalKPwd` in secrets.yaml
- **Expect:** The page opens signed in, with position and SOG. The password form appears only when the boat account is rejected.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Layout`)
