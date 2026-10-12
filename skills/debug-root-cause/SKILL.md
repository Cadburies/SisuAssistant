---
name: debug-root-cause
description: Use for any bug, wrong reading, unavailable entity, missing MQTT/Signal K value, failed esphome config/compile, failed deploy, or Sisu Nav error — before proposing a fix. Find where the ESP → HA → MQTT → Signal K → Influx/Grafana/Sisu Nav chain breaks first.
---

# Debug to root cause

Adapted from obra/superpowers `systematic-debugging` (MIT, see `../THIRD_PARTY_LICENSES.md`).

**No fix without a root cause.** A symptom fix in one layer usually breaks a consumer two layers down.

## 1. Investigate (before touching code)

1. **Read the whole error.** Note the file, line and entity id.
2. **Probe live first.** Run ping/nc/curl/`ha-ssh.sh` directly. Don't infer reachability from docs.
3. **What changed?** `git log -p --since=…` on the path, `./scripts/stack-drift.sh` (a box-side edit or a stale deploy is a common cause), and the closed issues touching it.
4. **Find the failing layer.** Probe each boundary once, upstream first:

   | Layer | Probe |
   | --- | --- |
   | ESP device | `ping` its IP (`NETWORK.md`); ESPHome logs (`esphome logs <entry>.yaml`); the raw sensor before filters |
   | HA entity | `/api/states/<entity_id>` (ha_token); is it unavailable, or a wrong value? Check the template/package that defines it |
   | MQTT `sisu/v1` | the publish map in `homeassistant/automations.yaml`; subscribe to the topic on `core_mosquitto` |
   | Signal K | `homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json` mapping; SK REST `/signalk/v1/api/vessels/self/<path>` on the F8 |
   | Influx / Grafana / Sisu Nav | the bucket query; `sisu-nav` `/api/health` + container logs (`f8-ssh.sh`) |

   The first layer where the value is wrong is where you fix it. Source priority is Mandatory rule 11: YDWG > DataHub > boat box > internet > derive. A "missing" value may just be a lower-priority source that is mute.
5. **Trace backwards** from the bad value to where it is produced. Fix at the source.

## 2. Compare

Find a working sibling (the other alternator, another tank, the Freezer Sources split that #68/#69 copy). List every difference. Don't dismiss any as "can't matter".

## 3. Hypothesis

One hypothesis: "X because Y". Test it with the smallest possible change, one variable at a time. If it's wrong, form a new hypothesis. Don't stack fixes.

## 4. Fix

- One fix at the root, then re-check the **original symptom** (`verify-before-done`).
- Firmware touching ENBL, field or ceilings → `.ai_context/safety.md` first. Never "fix" by weakening a ceiling.
- **Three failed fixes → stop.** It's likely the design, not the bug. Comment your findings on the issue and ask the human.

Red flags that send you back to step 1:
- "quick fix for now"
- "just try X"
- several changes at once
- proposing a fix before probing the layers
