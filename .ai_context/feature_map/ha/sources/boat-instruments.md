---
title: Sources › Boat instruments
id: ha/sources/boat-instruments
kind: card
tags: sources victron gx spectra alternators levels freezer error
status: live
script: boat-instruments.sh
---
Online flags for the boat's own systems: Victron GX, Spectra, alternator boards, levels board, freezer (and freezer error).

- **Reach:** HA → **Sources** → section **3 · Boat instruments** · `http://192.168.0.20:8123/lovelace-sources/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** `on` = data flowing; Alternators and Levels `off` until those Marine Boards are fitted (#11, #2).
- **Source:** `homeassistant/dashboards/sources.yaml` (`3 · Boat instruments`) · `homeassistant/packages/source_health.yaml`
