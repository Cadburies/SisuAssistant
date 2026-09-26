---
title: Network › Router & firewall rules
id: net/router
kind: hardware
tags: router gl-inet flint 3 gl-be9300 firewall routes dhcp reservations admin
status: live
script: router.sh
---
The GL-BE9300 routes between Sisu and Sisu-IoT with explicit firewall allows (people → HA, HA → every ESP, LAN → MQTT, phones → F8) and keeps Guest isolated.

- **Reach:** Browser on Sisu → `http://192.168.0.1` → GL.iNet admin
- **Action:** change SSIDs, DHCP reservations and firewall rules (admin only — follow the NETWORK.md checklist).
- **Needs:** on the boat's Sisu Wi-Fi/LAN; router admin password
- **Expect:** Admin page loads; the checklist in NETWORK.md §4.5 passes (HA reaches every ESP, phones reach HA/F8, Guest reaches nothing).
- **Source:** `NETWORK.md` §4 (`GL-BE9300 — required actions`)
