---
title: Sisu › Cameras view
id: ha/sisu/cameras-view
kind: view
tags: cameras view forward aft full screen stream side by side
status: live
script: cameras-view.sh
---
Full-size camera view: toggle Forward and/or Aft; one stream fills the screen, both show side by side.

- **Reach:** HA → **Sisu** → top tab **Cameras** · `http://192.168.0.20:8123/lovelace/cameras`
- **Action:** tap **Forward** / **Aft** toggles to choose which streams show. **Reinit forward** / **Reinit aft** reload that camera's ONVIF entry after a power cycle and set its clock.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** With neither selected: `Select Forward and/or Aft above to view.`; selected streams show live video when the cameras are reachable.
- **Source:** `homeassistant/ui-lovelace.yaml` (`path: cameras`) · `homeassistant/packages/camera_views.yaml`
