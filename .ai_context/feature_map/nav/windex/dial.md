---
title: Sisu Nav › Windex
id: nav/windex/dial
kind: panel
tags: windex wind dial twd awa head up north up dock full
status: live
script: dial.sh
---
Wind-instrument dial: true wind direction (outer) and apparent wind angle (inner) from Signal K.

- **Reach:** Sisu Nav → right stack → **Windex** panel
- **Action:** **Head up / North up** switches rose orientation; **Dock / Full** resizes the dial.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; Signal K login in the status bar
- **Expect:** Needles move with live wind; blank until signed in to Signal K; needles freeze at the last reading if the NMEA feed goes silent (Signal K keeps the last value).
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Windex`) · `sisu-nav/web/src/plugins/windex/`
