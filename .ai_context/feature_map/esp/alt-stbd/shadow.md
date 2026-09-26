---
title: Alternator Starboard › Shadow measure-only
id: esp/alt-stbd/shadow
kind: control
tags: shadow measure only commission field forced zero stbd safety
status: unverified
script: shadow.sh
---
Shadow mode: the board measures current, voltage and temperature but keeps the field at 0 — used during commissioning until sensors check out.

- **Reach:** `http://192.168.10.42/` → switch **Shadow measure-only · Starboard** (HA: Alternators › Starboard detail)
- **Action:** ON = field forced 0 (safe); OFF = board may drive the field. ⚠️ Safety-critical: only a person aboard, after the INSTALLATION §6.4 checks.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered; Starboard Marine Board fitted and online (#11); human on board (safety-critical)
- **Expect:** Default ON after flashing; field duty stays 0 % while ON.
- **Source:** `homeassistant/esphome/packages/marine_alternator.yaml` (`Shadow measure-only`) · `INSTALLATION.md` §6.4 · `.ai_context/safety.md`
