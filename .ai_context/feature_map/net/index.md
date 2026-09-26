---
title: Network › Vessel networks
id: net
kind: network
tags: network wifi lan iot guest ssid router subnets overview
status: live
script: index.sh
---
Three Wi-Fi networks on the GL.iNet Flint 3 router: **Sisu** (people, LAN 192.168.0.x), **Sisu-IoT** (ESP32 devices, 192.168.10.x) and **Sisu-Guest** (isolated).

- **Reach:** Join Wi-Fi **Sisu** on a phone/laptop (router admin `http://192.168.0.1`)
- **Action:** none — join the right network for what you need.
- **Needs:** the Sisu Wi-Fi password (guests: the saloon display's Wi-Fi QR)
- **Expect:** On Sisu you can reach HA (.20), the F8 (.21) and, through the router, the IoT devices' web pages.
- **Source:** `NETWORK.md` §2–§3
