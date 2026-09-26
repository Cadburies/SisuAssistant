---
title: Helm › Onboard systems links
id: ha/helm/links
kind: card
tags: links signal k kip alternators power water weather dashboards shortcuts
status: live
script: links.sh
---
Link list to Signal K/KIP on the F8 and to the other HA dashboards.

- **Reach:** HA → **Helm** → section **Links** · `http://192.168.0.20:8123/lovelace-helm/main`
- **Action:** tap a link → opens Signal K/KIP (`http://192.168.0.21:3000`) or the named dashboard.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Links open their targets; Signal K needs the F8 stack running.
- **Source:** `homeassistant/dashboards/helm.yaml` (`title: Links`)
