---
title: Sisu › Sources
id: ha/sisu/sources
kind: card
tags: sources health ydwg datahub victron spectra alternators levels freezer noaa wind path
status: live
script: sources.sh
---
One tile per data source (on = data flowing) plus the active wind path, and a button to the full Sources dashboard.

- **Reach:** HA → **Sisu** → section **Sources** · `http://192.168.0.20:8123/lovelace/default_view`
- **Action:** tap **All sources** → opens the Sources dashboard (`/lovelace-sources`).
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Green/on for every live source; boards not yet installed (Alternators, Levels) show off; Wind path names the gateway in use (`ydwg`, `datahub` or `none`).
- **Source:** `homeassistant/ui-lovelace.yaml` (`title: Sources`) · `homeassistant/packages/source_health.yaml`
