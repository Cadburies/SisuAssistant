---
title: Sisu › Cameras (mode & snapshots)
id: ha/sisu/cameras
kind: card
tags: camera aft forward mode off on sentry motion snapshot stream
status: live
script: cameras.sh
---
Aft and forward camera columns: mode selector (Off / On / Sentry), live stream when on, motion flag and last snapshot with its summary.

- **Reach:** HA → **Sisu** → section **Cameras** · `http://192.168.0.20:8123/lovelace/default_view`
- **Action:** tap **Camera Mode** → choose Off, On or Sentry (Sentry: motion triggers a photo burst). Stream and snapshot panels only appear when the mode allows.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Mode shows the current choice; last snapshot info like `Timed · 2026-09-26 10:30:00` or `No snapshot yet`; stream tile blank/unavailable when the camera is off the network.
- **Source:** `homeassistant/ui-lovelace.yaml` (`title: Cameras`) · `homeassistant/packages/sv3c_aft_camera.yaml` · `homeassistant/packages/sv3c_forward_camera.yaml`
