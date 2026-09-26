---
title: Helm › Status chips
id: ha/helm/status
kind: card
tags: helm status nmea source ydwg datahub anchor alarm gps lost distance house voltage charging
status: live
script: status.sh
---
Top chips: active NMEA source, YDWG/DataHub health, anchor alarm and GPS-lost, distance from the drop point, house voltage and charging.

- **Reach:** HA → **Helm** → first section · `http://192.168.0.20:8123/lovelace-helm/main`
- **Action:** display only; tap a chip for its history.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** NMEA source names the gateway in use; anchor chips `off` when not anchored; distance `unavailable` until an anchor drop is set.
- **Source:** `homeassistant/dashboards/helm.yaml` · `homeassistant/packages/source_health.yaml` · `homeassistant/packages/anchor_watch.yaml`
