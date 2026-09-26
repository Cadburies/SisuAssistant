---
title: DataHub NMEA gateway (failover)
id: ext/datahub
kind: device
tags: datahub nmea gateway failover source tcp 11102
status: live
script: datahub.sh
---
Second NMEA gateway used when YDWG is silent (currently supplies position and SOG).

- **Reach:** Device at `192.168.10.31` (NMEA TCP port 11102)
- **Action:** none day to day.
- **Needs:** on the boat LAN · kernel reads TCP 11102
- **Expect:** TCP 11102 streams sentences; Sources dashboard shows a small DataHub age.
- **Source:** `homeassistant/addons/sisu_nmea_ingest/config.yaml` (`datahub_host`) · `homeassistant/signalk/settings.json` · `.ai_context/sources.md`
