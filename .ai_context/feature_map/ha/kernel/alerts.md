---
title: Kernel › Ingest & polar alerts
id: ha/kernel/alerts
kind: flow
tags: alert notification nmea ingest down recovered engine rpm polar paused
status: live
script: alerts.sh
---
Alerts when both NMEA gateways go silent (and clears on recovery), and when engine RPM is unknown so polar logging pauses.

- **Reach:** HA → Settings → Automations → `Sisu · NMEA Ingest …` / `Sisu · Engine RPM …` · `http://192.168.0.20:8123/config/automation/dashboard`
- **Action:** fire automatically; notifications appear in HA and on phones.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** No active alert in normal operation; each `…Down/Unknown` alert is followed by its `…Recovered` clear.
- **Source:** `homeassistant/automations.yaml` (`sisu_nmea_ingest_dead_alert` …) · `homeassistant/packages/polar_logging.yaml`
