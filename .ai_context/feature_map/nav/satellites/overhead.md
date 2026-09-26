---
title: Sisu Nav › Satellites overhead
id: nav/satellites/overhead
kind: layer
tags: satellites overhead celestrak tle ground track norad
status: live
script: overhead.sh
---
Ground-track dots for satellites whose footprint covers the view (CelesTrak TLEs) — not pass prediction.

- **Reach:** Sisu Nav → **Layers** (top of map) → **Satellites overhead**
- **Action:** toggle; click for name/NORAD id.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers
- **Expect:** Moving dots; TLE list fetched from CelesTrak.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Satellites overhead`) · `sisu-nav/api/satellites/` · `sisu-nav/web/src/plugins/satellites/`
