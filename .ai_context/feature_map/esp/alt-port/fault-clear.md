---
title: Alternator Port › Clear fault
id: esp/alt-port/fault-clear
kind: control
tags: fault latched clear reset hard fault port enbl
status: unverified
script: fault-clear.sh
---
Hard faults (stale sensor, current/voltage/temperature ceiling) latch the field off until cleared.

- **Reach:** `http://192.168.10.41/` → button **Clear Alternator Fault · Port** (HA: Alternators › Port detail; also an ENBL off→on cycle)
- **Action:** clears the latch; the controller restarts from zero if the cause is gone. ⚠️ Safety-critical.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered; Port Marine Board fitted and online (#11); human on board; cause of the fault understood
- **Expect:** Fault-latched goes off; if the cause persists it re-latches immediately.
- **Source:** `homeassistant/esphome/packages/marine_alternator.yaml` (`Clear Alternator Fault`) · `.ai_context/safety.md` (fault latch)
