---
title: Network › Reaching IoT devices
id: net/iot-hop
kind: flow
tags: iot esp32 esphome hop reach web server ota api ha green ssh 192.168.10
status: live
script: iot-hop.sh
---
ESP32 devices live on Sisu-IoT; people on Sisu reach their web pages through the router, agents reach them from the HA Green shell.

- **Reach:** People: browser on Sisu → `http://192.168.10.4x/` · agents: `scripts/ha-ssh.sh` then `curl http://192.168.10.4x/`
- **Action:** open a device's own web page (ESPHome web_server) or its OTA/API from HA.
- **Needs:** on the boat's Sisu Wi-Fi/LAN; device powered and on Sisu-IoT · agents: HA Green SSH
- **Expect:** The device's page answers (e.g. saloon display `.45`); boards not yet fitted do not answer.
- **Source:** `NETWORK.md` §3.1 · `scripts/esphome_web_client.py` · `.ai_context/feature_map/_lib.sh` (`esp_get`)
