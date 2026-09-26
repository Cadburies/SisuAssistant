---
title: YDWG-02 NMEA gateway
id: ext/ydwg
kind: device
tags: ydwg yacht devices wifi gateway nmea 2000 0183 primary source
status: live
script: ydwg.sh
---
Yacht Devices YDWG-02: the primary NMEA 2000 → NMEA 0183 source for the kernel and Signal K.

- **Reach:** Device at `192.168.10.30` (NMEA TCP port 1456; own web UI on port 80)
- **Action:** none day to day; configure via its web UI.
- **Needs:** on the boat LAN; N2K backbone powered · kernel reads TCP 1456
- **Expect:** TCP 1456 accepts connections and streams sentences. It can accept TCP yet send no NMEA (seen 2026-09-25/26, #162) — the kernel then treats it as mute and HA values go `unavailable`.
- **Source:** `homeassistant/addons/sisu_nmea_ingest/config.yaml` (`ydwg_host`) · `homeassistant/signalk/settings.json` · `.ai_context/sources.md`
