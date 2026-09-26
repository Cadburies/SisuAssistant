---
title: Sources › Internet fallback
id: ha/sources/internet
kind: card
tags: internet fallback noaa tides met no open meteo weather
status: live
script: internet.sh
---
Internet sources used when the boat has no instrument for a quantity: NOAA tides, Met.no and Open-Meteo.

- **Reach:** HA → **Sources** → section **4 · Internet fallback** · `http://192.168.0.20:8123/lovelace-sources/main`
- **Action:** display only.
- **Needs:** internet connection · on the boat's Sisu Wi-Fi/LAN · HA REST with `ha_token`
- **Expect:** All `on` with internet; `off` offshore without connectivity.
- **Source:** `homeassistant/dashboards/sources.yaml` (`4 · Internet fallback`) · `homeassistant/packages/source_health.yaml` · `homeassistant/packages/marine_environment.yaml`
