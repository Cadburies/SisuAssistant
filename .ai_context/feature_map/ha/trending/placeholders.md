---
title: Trending › Placeholder vessel entities
id: ha/trending/placeholders
kind: card
tags: placeholder entities tanks genset future stable ids
status: planned
script: placeholders.sh
---
Stable placeholder entities (tank levels/volumes, genset) so dashboards keep working until the real hardware reports.

- **Reach:** Seen on HA → **Sisu** / **Water** / **Engine** tiles that read `unavailable` or `awaiting marine board`
- **Action:** none — they are replaced by real sensors when the boards arrive.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Tank tiles `unavailable`, genset status `awaiting marine board` until the levels/genset boards exist (#2).
- **Source:** `homeassistant/packages/vessel_placeholders.yaml`
