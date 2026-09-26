---
title: Cameras › Aft camera (SV3C)
id: ha/cameras/aft
kind: device
tags: aft camera sv3c onvif poe mode off on sentry motion photo burst snapshot reboot
status: live
script: aft.sh
---
SV3C PoE camera (watches the dinghy at the aft cockpit): Off / On / Sentry modes, motion → photo burst, a timed snapshot every 5 min in Sentry, reboot and clock-sync buttons.

- **Reach:** HA → **Sisu** → **Cameras** (mode) or Settings → Devices → **Aft Camera** (reboot / set time) · camera `192.168.0.33`
- **Action:** choose **Mode**: Off (no stream), On (live stream), Sentry (motion → burst + timed snapshots); **Reboot** restarts the camera; **Set system date and time** syncs its clock.
- **Needs:** camera powered on the PoE switch · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Mode shows the choice; stream live when reachable; last snapshot summary names the trigger and time. Known issue #167: in Sentry the timed snapshot records a new time even when the camera is offline.
- **Source:** `homeassistant/packages/sv3c_aft_camera.yaml` · `homeassistant/ui-lovelace.yaml` (`title: Cameras`)
