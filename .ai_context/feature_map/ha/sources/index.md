---
title: Sources › Dashboard
id: ha/sources
kind: dashboard
tags: sources data sources health priority kernel dashboard
status: live
script: index.sh
---
Which data sources are actually delivering data, in kernel priority order: NMEA gateways, boat instruments, internet fallbacks, derived values.

- **Reach:** HA → sidebar **Sources** (or Sisu › Sources › **All sources**) · `http://192.168.0.20:8123/lovelace-sources/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Header shows the wind path and each gateway's data age in seconds.
- **Source:** `homeassistant/dashboards/sources.yaml` · `.ai_context/sources.md`
