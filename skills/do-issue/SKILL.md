---
name: do-issue
description: Use for "do issue #N", "pick next work", "do all <label> issues", or any non-trivial task in this repo. Runs the full Sisu task loop — pick, claim, plan, implement, verify, independent review, deploy, release, commit and push — with the gates as scripts, not memory.
---

# Do an issue (Sisu task loop)

Rules live in `CLAUDE.md` (Mandatory rules, tiers, self-heal). This is the procedure. Every gate below is a script. Run it and read its output; never re-derive the check by hand.

## 1. Pick and claim (before any code)

```bash
./scripts/next-issue.sh            # first line = pick (P1>P2>P3, lowest #); --all shows skips + why
./scripts/claim.sh N --as <you>    # refuses on Touches overlap / owned hotspot / bad pair / open Depends on
```

- Batch commands → `gh issue list --state open --label <label>`, then `claim.sh` each in order: "do all safety issues" = `safety-critical`, "firmware issues" = `firmware`, "vessel-ops issues" = `vessel-ops` (mostly `needs-human`; skip and comment when blocked).
- A one-off with no issue → `file-issue` skill first, then claim it.
- `claim.sh` refuses → pick another. Never override it by hand.
- No concrete Touches → fix the issue body first. Touches is the only parallel-safety signal.

## 2. Plan

- Short bullets: change, files, acceptance (mirror the issue's boxes). Vague intent (e.g. "intended target unclear") → ask the human, don't guess.
- Network / deploy / vessel access → `NETWORK.md` / `OPS.md` (the section the issue needs only).
- Electrical / alternator / ENBL / limits → re-read the matching section of `.ai_context/safety.md` + `homeassistant/docs/ALTERNATOR_LIMITS.md`.
- MQTT / Signal K / entity rename → `.ai_context/data_flow.md` section; plan the HA → MQTT → SK cascade **before** coding.
- Dashboard card, Sisu Nav plugin/route, ESPHome control → `.ai_context/feature_map/who-uses.sh <path>` for the feature-map pair to update.
- A bug → `debug-root-cause` skill before proposing any fix.

## 3. Implement

Smallest change. No drive-by refactors. `!secret` for credentials. Shadow measure-only stays ON for first commission. Cascade: `CLAUDE.md` Mandatory rule 3.

## 4. Verify (deterministic)

```bash
./scripts/verify.sh --issue N --live --summary /tmp/verify-N.md <files you touched>
```

- Exit **1** → fix, re-run. Exit **3** → green, but the printed deploy lines are still owed (step 6).
- `⚠️ outside #N Touches` → either add the path to the issue's Touches (first check no other open claim lists it: `gh issue list --label agent:<other>`) or revert the stray edit.
- `⚠️ hard ceiling` → stop. Human approval, then a `Human-Approved:` trailer (commit-msg enforces it).
- Pass explicit files in a shared tree. The default `@{u}` diff also picks up other agents' edits.
- Then apply `verify-before-done` and claim nothing the output doesn't show.

## 5. Independent review

`review-diff` skill: a fresh reviewer agent ([`../review-diff/reviewer.md`](../review-diff/reviewer.md)) reads the issue and your diff only. `BLOCK` → fix, re-verify, re-review, at most 2 rounds. Then comment the open findings on the issue and leave it for the human.

## 6. Deploy what git doesn't (exit 3 lines)

- HA Green:
  1. Reachable (`ping -c1 192.168.0.20`), and verify.sh green (syntax).
  2. `./scripts/stack-drift.sh green`.
  3. `./scripts/ha-deploy-config.sh <files>` (always pass files; read for `ERROR: size mismatch`).
  4. `./scripts/ha-cli.sh core check`. It must print a config summary. The first time in a session, cross-check it once against a known-bad config, because a bare "Command completed successfully" can mean it silently no-oped.
  5. A scoped `*.reload` (`automation.reload`, `template.reload`, …) is enough for most edits. A **Core restart** is needed for a new package file, a `homeassistant:` block change or a new integration. It's safe, don't ask.
  6. `stack-drift.sh green` again.
- `automations.yaml` / MQTT topic changed and the broker is up → publish one test message on the changed topic and confirm it arrives (and reaches the SK path, if mapped).
- F8: `./scripts/f8-deploy.sh` → `stack-drift.sh f8`. A `signalk/**` change → confirm the changed SK path in the F8's SK REST API.
- Drift you did not cause → flag it, never push it (it may be another agent's work).
- Vessel unreachable → say so in the summary; leave the live acceptance box open.

## 7. Context, release, commit

1. Self-heal Tier A/B you contradicted. Update onboarding docs / sisu-nav docs / feature map in the **same** change (`CLAUDE.md` §Self-heal). Keep `INDEX.md` NEXT ≤ 6 lines. Delete resolved `risks.md` rows.
2. `unslop` the commit message and the summary.
3. `./scripts/release.sh N --as <you> --summary /tmp/verify-N.md [--close]`. It always drops the claim label. Close only if every Acceptance box is met.
4. `git add <exact files>` (never `-A`) → commit with `#N` → `git push origin main`. Rejected → `git fetch && git rebase origin/main`, re-run verify, push. Never force-push.

Blocked (hardware, `Depends on`, vessel offline for a live-only box) → comment why, `release.sh N --as <you>` without `--close`, pick next. Never flail.
