---
title: Alternator Port › Shadow measure-only
id: esp/alt-port/shadow
kind: control
tags: shadow measure only commission field forced zero port safety
status: unverified
script: shadow.sh
---
Shadow mode: the board measures current, voltage and temperature but keeps the field at 0 — used during commissioning until sensors check out.

- **Reach:** `http://192.168.10.41/` → switch **Shadow measure-only · Port** (HA: Alternators › Port detail)
- **Action:** ON = field forced 0 (safe); OFF = board may drive the field. ⚠️ Safety-critical: only a person aboard, after the INSTALLATION §6.4 checks.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered; Port Marine Board fitted and online (#11); human on board (safety-critical)
- **Expect:** Default ON after flashing; field duty stays 0 % while ON.
- **Source:** `homeassistant/esphome/packages/marine_alternator.yaml` (`Shadow measure-only`) · `INSTALLATION.md` §6.4 · `.ai_context/safety.md`
