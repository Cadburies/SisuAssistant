---
title: Sources › NMEA gateways
id: ha/sources/nmea
kind: card
tags: nmea ydwg datahub gateway failover age error wind using
status: live
script: nmea.sh
---
YDWG-02 (primary) and DataHub (failover): online, which one wind uses, data age and last error.

- **Reach:** HA → **Sources** → section **1 · NMEA** · `http://192.168.0.20:8123/lovelace-sources/main`
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** Healthy: age a few seconds, error empty. A dead gateway shows a large age and an error like `No route to host`; Wind using should then name the other gateway. Known issue #162: Wind using can keep saying `ydwg` after YDWG died.
- **Source:** `homeassistant/dashboards/sources.yaml` (`1 · NMEA`) · `homeassistant/packages/source_health.yaml` · `homeassistant/nmea_wind_daemon/nmea_wind_daemon.py`
