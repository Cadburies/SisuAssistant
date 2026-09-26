---
title: Helm › Dashboard
id: ha/helm
kind: dashboard
tags: helm dashboard anchor route nmea instruments navigation
status: live
script: index.sh
---
Helm dashboard: status chips, active route, NMEA instruments, anchor watch with map, and links to the other systems.

- **Reach:** HA → sidebar **Helm** (or Sisu › Ship zones › Helm) · `http://192.168.0.20:8123/lovelace-helm/main`
- **Action:** display plus anchor-watch controls (see Anchor watch).
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Header explains that primary navigation stays on the N2K chartplotter/OL43; HA is for automation and status.
- **Source:** `homeassistant/dashboards/helm.yaml` · `homeassistant/configuration.yaml` (`lovelace-helm`)
