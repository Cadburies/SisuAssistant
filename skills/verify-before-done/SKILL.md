---
name: verify-before-done
description: Use before saying anything is done, fixed, working, deployed or passing — before a commit, a push, closing an issue, ticking an Acceptance box, or reporting another agent's result. Evidence before claims.
---

# Verify before done

Adapted from obra/superpowers `verification-before-completion` (MIT, see `../THIRD_PARTY_LICENSES.md`), mapped to this repo's gates.

**No completion claim without fresh evidence from this turn.** You can't say something passed unless you ran it in this message and read the output.

## The gate

1. **Identify** the command that proves the claim (table below).
2. **Run** it in full, fresh. A previous run doesn't count.
3. **Read** the output and the exit code.
4. **State** what it shows: green with the evidence, or the actual status. Never write "should", "probably" or "seems to".

| Claim | Proof | Not proof |
| --- | --- | --- |
| Commit is safe | `scripts/verify.sh <files>` exit 0, or 3 with deploy done | scan_secrets alone |
| ESPHome change OK | `esphome config <entry>` for **every** entry including the package (verify.sh fans out) | one entry |
| HA change is live | `ha-deploy-config.sh` with no `ERROR: size mismatch`, `ha-cli.sh core check` with a config summary, `stack-drift.sh green` exit 0 | `git push`; "Command completed successfully" with no summary |
| Dashboard works | `verify.sh --live` entity check, plus a screenshot (`ui-evidence`) | YAML parses |
| Sisu Nav change works | `tsc --noEmit` + `/api/health` 200 after `f8-deploy.sh` + the panel exercised in a browser | build passes |
| Bug fixed | the original symptom re-checked (entity state, MQTT topic, SK path, log line) | code changed |
| Subagent finished | `git diff` shows the change, and you re-ran verify | its report |
| Issue done | each Acceptance box re-read and checked off with its evidence | verify green |

## Vessel offline

Say "skipped: HA Green unreachable" (or F8). Leave live-only Acceptance boxes unticked and the issue open. Skipped is not passed.

## Red flags

Stop and run the gate when you notice:
- "Done!" or "Fixed!" before output
- trusting an agent's report
- "just this once"
- relying on a partial check
- a green that came from an earlier edit
