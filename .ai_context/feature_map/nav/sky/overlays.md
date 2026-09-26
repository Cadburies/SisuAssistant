---
title: Sisu Nav › Sky (rain, clouds, radar, dust)
id: nav/sky/overlays
kind: layer
tags: rain clouds radar dust rainviewer open meteo sky overlay
status: live
script: overlays.sh
---
Forecast rain, clouds and dust (Open-Meteo) and live radar (RainViewer). Dust is one-at-a-time with weather particles.

- **Reach:** Sisu Nav → **Layers** (top of map) → **Rain** / **Clouds** / **Radar** / **Dust**
- **Action:** toggle layers; local-time slider.
- **Needs:** on the boat's Sisu Wi-Fi/LAN with the F8 running; internet for forecast/online layers
- **Expect:** Coloured fields over the view; radar tiles where coverage exists.
- **Source:** `sisu-nav/USER_GUIDE.md` (`## Sky`) · `sisu-nav/web/src/plugins/wx-extra/` · `sisu-nav/api/weather/` (`/api/weather/sky`, `/api/weather/radar`)
