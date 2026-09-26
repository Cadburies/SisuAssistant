---
title: Sisu Nav › Ensemble wind
id: nav/ensemble/spaghetti
kind: layer
tags: ensemble spaghetti ecmwf ifs ens aifs gefs members deep clustered
status: live
script: spaghetti.sh
order: 64
---
ECMWF IFS ENS spaghetti plot (51 members) — also AIFS and GEFS, one ensemble at a time.

- **Reach:** Sisu Nav → **Layers** (top of map) → **Ensemble wind (ECMWF IFS)** (or AIFS / GEFS) → **Ensemble** panel
- **Action:** **Deep** loads all 51 members; click a line for the per-member table; ~15-day time slider.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers
- **Expect:** Default: control run + 10 members; Deep is heavier.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Ensemble wind`) · `sisu-nav/web/src/plugins/ensemble/` · `sisu-nav/api/ensemble/` (`/api/ensemble`)
