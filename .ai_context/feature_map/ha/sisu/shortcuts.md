---
title: Sisu › Shortcuts
id: ha/sisu/shortcuts
kind: control
tags: shortcuts links sisu nav signal k kip grafana influxdb mqtt explorer tileserver tiles f8 web ui
status: live
script: shortcuts.sh
---
One-tap buttons from the main board to every web app on the F8 server.

- **Reach:** HA → **Sisu** → section **Shortcuts** · `http://192.168.0.20:8123/lovelace/default_view`
- **Action:** tap **Sisu Nav / Signal K / KIP / Grafana / InfluxDB / MQTT Explorer / Tiles** → opens that app in a new browser tab (in the HA app: the in-app browser).
- **Needs:** on the boat's Sisu Wi-Fi/LAN; the F8 server up · F8 `192.168.0.21`
- **Expect:** Each tap opens the named app; a blank/"can't connect" page means that F8 container is down.
- **Source:** `homeassistant/ui-lovelace.yaml` (`title: Shortcuts`) · `OPS.md` (§7 service list)
