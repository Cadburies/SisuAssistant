---
name: debug-root-cause
description: Use for any bug, wrong reading, unavailable entity, missing MQTT/Signal K value, failed esphome config/compile, failed deploy, or Sisu Nav error — before proposing a fix. Find where the ESP → HA → MQTT → Signal K → Influx/Grafana/Sisu Nav chain breaks first.
---

# Debug to root cause

Adapted from obra/superpowers `systematic-debugging` (MIT, see `../THIRD_PARTY_LICENSES.md`).

**No fix without a root cause.** A symptom fix in one layer usually breaks a consumer two layers down.

## 1. Build a red-capable loop

No hypothesis until one command reproduces the user's exact symptom and can go red on this bug. Spend disproportionate effort here; it is the skill.

Pick the cheapest loop that drives the real path:

- HA: `/api/states/<entity_id>` or the template that renders it
- MQTT: `mosquitto_sub -t '<topic>' -C 1` against `core_mosquitto`
- Signal K: `curl` `/signalk/v1/api/vessels/self/<path>` on the F8
- ESPHome: `esphome logs <entry>.yaml`, filtered to the raw value before filters
- Sisu Nav / F8: `/api/health`, a route, or the container log line

Done when the command is:

- [ ] **red-capable** — asserts the exact symptom, not "runs without error"
- [ ] **deterministic** — same verdict every run; for a flake, a pinned high repro rate
- [ ] **fast** — seconds, not minutes
- [ ] **agent-runnable** — unattended; a human only for a physical action

If no loop can be built, stop and ask for live access or a captured artifact. Do not move to a hypothesis.

## 2. Locate the layer

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

## 3. Compare

Find a working sibling (the other alternator, another tank, the Freezer Sources split that #68/#69 copy). List every difference. Don't dismiss any as "can't matter".

## 4. Hypothesise (3–5, ranked)

Write 3–5 falsifiable hypotheses before testing one: "If X is the cause, changing Y makes the symptom disappear, or changing Z makes it worse." State the prediction; a vibe is not a hypothesis. Share the ranked list with the human before testing — their domain knowledge re-ranks it fast. Proceed if they are AFK.

## 5. Instrument

Each probe maps to one prediction; change one variable at a time. Prefer a debugger or a state read over logs. Use targeted logs only at the boundaries that separate hypotheses, never "log everything and grep". Tag every temporary log `[DEBUG-<4hex>]`; cleanup is one grep.

## 6. Fix

- One fix at the root, then re-check the **original symptom** (`verify-before-done`).
- Fix the pattern, not the instance: find every place with the same fault.
- Firmware touching ENBL, field or ceilings → `.ai_context/safety.md` first. Never "fix" by weakening a ceiling.
- **Three failed fixes → attack the premise.** Write the one sentence every failed fix assumed, then test it before fix #4. It is likely the design, not the bug. Comment your findings on the issue and ask the human.

## 7. Lock it down

- Re-run the §1 loop against the original, un-minimised scenario.
- `grep -r '\[DEBUG-'` and remove every probe.
- If the repro is cheap and stable, turn it into a `scripts/` check or a `verify.sh` assertion (Sisu has no unit suite). Otherwise record the loop command on the issue as the regression check.
- State the confirmed cause in the commit or issue so the next debugger starts there.

Red flags that send you back to step 1:
- "quick fix for now"
- "just try X"
- several changes at once
- a hypothesis before a red loop
- "log everything and grep"
- proposing a fix before probing the layers
