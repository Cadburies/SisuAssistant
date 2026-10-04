---
title: Cameras › Forward camera (SV3C)
id: ha/cameras/forward
kind: device
tags: forward camera sv3c onvif poe mode off on sentry motion photo burst snapshot reboot reinit
status: live
script: forward.sh
---
SV3C PoE camera (forward deck): Off / On / Sentry modes, motion → photo burst, a timed snapshot every 5 min in Sentry, reboot and clock-sync buttons. Also: IR lamp, autofocus and wiper switches.

- **Reach:** HA → **Sisu** → **Cameras** (mode) or Settings → Devices → **Forward Camera** (reboot / set time) · camera `192.168.0.34`
- **Action:** choose **Mode**: Off (no stream), On (live stream), Sentry (motion → burst + timed snapshots); **Reinit** after a power cycle reloads ONVIF and sets the clock; **Reboot** restarts the camera; **Set system date and time** syncs its clock.
- **Needs:** camera powered on the PoE switch · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Mode shows the choice; stream live when reachable; last snapshot summary names the trigger and time. While the camera is offline no snapshot is taken and the last-snapshot time does not move. **Reinit** reloads ONVIF, waits until the stream is back, then sets the clock.
- **Source:** `homeassistant/packages/sv3c_forward_camera.yaml` · `homeassistant/ui-lovelace.yaml` (`title: Cameras`)
