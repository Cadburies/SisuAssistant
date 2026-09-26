---
title: Helm › Anchor watch
id: ha/helm/anchor-watch
kind: control
tags: anchor watch alarm drag radius set here drop suggested breach delay map enable
status: live
script: anchor-watch.sh
---
Anchor watch: arm the alarm, set the drop point, radius and breach delay, see distance/bearing to the drop and both positions on a map.

- **Reach:** HA → **Helm** → section **Anchor** · `http://192.168.0.20:8123/lovelace-helm/main`
- **Action:** **Set here** → stores the current position as the anchor drop; **Apply suggested radius** → copies the suggested radius; change **Radius** / **Breach delay**; toggle **Alarm enable** → arms/disarms. Drag outside the radius for longer than the delay → alarm + phone notification.
- **Needs:** GPS fix from the NMEA gateway · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Disarmed: alarm `off`, distance `unavailable`. Armed after Set here: distance/bearing live, map shows boat and drop; alarm turns `on` only past radius + delay.
- **Source:** `homeassistant/dashboards/helm.yaml` (`title: Anchor`) · `homeassistant/packages/anchor_watch.yaml`
