---
title: SV3C PoE cameras (device)
id: ext/sv3c-cameras
kind: device
tags: sv3c camera poe onvif aft forward device web ui
status: unverified
script: sv3c-cameras.sh
---
Two SV3C PoE cameras (forward `.33`, aft `.34`) controlled by HA over ONVIF. Roles swapped 2026-10-04 (#193): forward is MAC `F0:00:00:40:4E:96`, aft is MAC `F0:00:00:41:BC:CE`.

- **Reach:** Device web UIs `http://192.168.0.33/` (forward) and `http://192.168.0.34/` (aft)
- **Action:** camera settings on the device; modes from HA (Cameras).
- **Needs:** on the boat LAN; PoE switch powered
- **Expect:** Web UI and ONVIF answer when the camera is powered. On 2026-11-17 neither unit answered ARP. Aft's last real JPEG was 2026-10-24 03:52. Forward has had no snapshot since 2026-08-15.
- **Source:** `homeassistant/packages/sv3c_aft_camera.yaml` · `homeassistant/packages/sv3c_forward_camera.yaml`
