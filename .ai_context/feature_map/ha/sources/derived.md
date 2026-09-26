---
title: Sources › Derived values note
id: ha/sources/derived
kind: card
tags: derived values kernel rule wind path none failure
status: live
script: derived.sh
---
Explains the rule: nothing is derived while an instrument sentence is live; wind path `none` means both gateways are mute.

- **Reach:** HA → **Sources** → section **5 · Derived** · `http://192.168.0.20:8123/lovelace-sources/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Text with the current wind path; `none` is the #49 failure mode this screen exists to show.
- **Source:** `homeassistant/dashboards/sources.yaml` (`5 · Derived`) · `.ai_context/sources.md`
