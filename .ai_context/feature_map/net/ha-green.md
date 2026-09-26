---
title: Network › HA Green (192.168.0.20)
id: net/ha-green
kind: host
tags: ha green home assistant host ssh supervisor 8123 mqtt 1883
status: live
script: ha-green.sh
---
Home Assistant Green on Ethernet: runs HA, the MQTT kernel and ESPHome; the gateway for reaching the IoT network.

- **Reach:** Browser on Sisu → `http://192.168.0.20:8123` · SSH `scripts/ha-ssh.sh`
- **Action:** open HA; agents deploy config with `scripts/ha-deploy-config.sh` and check it with `scripts/ha-cli.sh core check`.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · SSH key or `ha_ssh_*` secrets; API `ha_token`
- **Expect:** HA login page / API answers `API running.`; SSH lands in the Green shell.
- **Source:** `NETWORK.md` §4.1 · `OPS.md` · `scripts/ha-ssh.sh`
