---
title: Alternator › Shadow commissioning (flow)
id: esp/alt-port/commission-flow
kind: flow
tags: commission shadow first power on checks current voltage temperature calibration
status: live
script: commission-flow.sh
---
The order to bring a new alternator board into service: flash, Shadow ON, verify current/voltage/temperature against reference, then Shadow OFF.

- **Reach:** `INSTALLATION.md` §6.4 — follow on board with a clamp meter
- **Action:** each step uses the Shadow, setpoints and fault-clear controls above. ⚠️ Safety-critical.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered; a person aboard with meters; engine running for the last steps
- **Expect:** Readings match the meters within tolerance before Shadow goes OFF; any fault latches the field off.
- **Source:** `INSTALLATION.md` §6.4 · `homeassistant/docs/ALTERNATOR_TUNING.md` · `.ai_context/safety.md`
