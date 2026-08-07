# Sisu Assistant — AI Project Instructions

> Project-specific runtime contract for any coding agent (Claude, Grok, Codex, …).
> Orientation router: `.ai_context/INDEX.md`. Portable hard rules also in `AGENTS.md`.

## Session start (token budget)

1. Read `.ai_context/INDEX.md` only.
2. From its **Read-Next** table, load **at most 1–2** topical files (prefer named sections).
3. Prefer **source of truth** (YAML / scripts / compose) over inventory docs.
4. **Never** load by default: `.ai_context/archive/*`, full long specs dumps, `node_modules`, changelog history.

**Budget:** INDEX + ≤2 topical files + relevant source. Exceed only if blocked.

Do not invent entity IDs, MQTT topics, or Signal K paths — derive from source.

---

## What belongs in context (tiers)

| Tier | Content | Maintain? |
| --- | --- | --- |
| **A** | Decisions, safety invariants, open risks, `INDEX` NEXT | Yes — keep accurate |
| **B** | Cross-file synthesis (data flow, naming, displays, secrets policy) | Yes if wrong |
| **C** | Derivable inventory (entity lists, full field catalogs, PID dumps) | **Do not maintain** — path pointer only |
| **D** | History | `git log` + **closed GitHub issues**; snapshots in `archive/` — never session-load |

**Golden rule:** context holds *non-derivable* truth only. If one source file answers it, write a path pointer, not a second copy.

**Open backlog = GitHub Issues** (`gh issue list --state open`). There is no `outstanding.md`.

---

## Self-heal (continuous, narrow)

When reading source that **contradicts a Tier A/B claim**, fix the context file immediately (one sentence in the reply is enough).

- Do **not** expand silence into entity catalogs or code dumps.
- If you catch yourself updating a mirror of source, **delete that section** and leave a path pointer.
- Resolved risks: **delete** the row (never long-lived `~~strikethrough~~`).
- Closed work: close the GitHub issue; do not keep a parallel backlog file.

---

## How a task works

### 1. Pick & claim (before any planning or code)

1. Resolve the task: explicit ask (`do issue #N`), batch (`pick next work` / `do all safety issues`), or a one-off the user just typed. See §Issue kickoff.
2. Before claiming, check in-flight work: `gh issue list --state open` and skip any open issue carrying an `agent:*` label — that is another agent in this shared tree.
3. Check **parallel safety** against every currently claimed issue: no overlap in **Touches**, not a listed bad pair, and not a single-owner hotspot another claim already owns (see §Parallel agents). If it collides, pick a different task.
4. Claim **first, before writing any code**:
   ```bash
   gh issue edit <N> --add-label agent:<you>
   gh issue comment <N> --body "Claimed by <you>. Parallel-safe vs open claims: <why>."
   ```
   Only once the claim lands, move to Plan. `<you>` examples: `grok`, `claude`, `codex`.

### 2. Plan

- Short bullet list: change, files, acceptance criteria.
- Electrical / alternator / ENBL / limits → re-read matching section of `safety.md` + `homeassistant/docs/ALTERNATOR_LIMITS.md`.
- Cascade renames (entity → automation → MQTT → Signal K) before coding.

### 3. Implement

- Smallest change that meets the requirement. No drive-by refactors.
- Comments only for non-obvious *why*.
- Prefer `!secret` / `secrets.yaml` for any credential; never inline passwords or API keys.
- Production wrappers: `test_mode_enabled` must stay `"false"` unless deliberate bench work.

### 4. Verify (project has no unit-test suite)

Use what exists for the scope you touched:

```bash
# Secrets gate (always before commit/push)
./scripts/scan_secrets.sh

# ESPHome config check (any device/package change)
esphome config homeassistant/esphome/alternatorport.yaml
esphome config homeassistant/esphome/alternatorstarboard.yaml
esphome config homeassistant/esphome/waterlevels.yaml
esphome config homeassistant/esphome/freezer.yaml
esphome config homeassistant/esphome/bench_alts_sim.yaml

# HA / stack (when vessel or F8 reachable)
./scripts/ha-ssh.sh 'ls /config/esphome'
docker compose -f homeassistant/docker-compose.yml config
```

**Safety-critical alternator control** (`packages/marine_alternator.yaml`, hard ceilings): extra human review before OTA to production boards. Do not weaken `ALT_I_CEIL` / `ALT_T_CEIL` / `HOUSE_V_CEIL` without explicit approval.

### 5. Update context (end of task)

1. Update **Tier A/B** files actually affected (not every file).
2. Cap `INDEX.md` → **NEXT** at ~6 lines.
3. Comment the GitHub issue with verify result, files touched, blockers; close if acceptance met.
4. Remove the claim: `gh issue edit <N> --remove-label agent:<you>` (closing alone leaves the label and looks claimed).
5. Open risks only in `risks.md` — delete resolved rows.

### 6. Commit & push (closing rule — after verify is green)

1. `git add` **specific files the task touched** — never blanket `git add -A` in a shared tree (see §Parallel agents).
2. Commit with a message describing the change and why (include `#N` when applicable).
3. `git push origin <current-branch>`. If rejected: fetch + rebase/merge, retry — **never force-push** to `main`.
4. Skip only if verify failed, user asked to hold, or pure investigation with no diff.

---

## Mandatory rules

1. **Non-derivable only** in `.ai_context/`. Path pointers over copies.
2. **Alternator hard cutoffs sacred** (250 A / 14.4 V / 125 °C). Change only with human approval + update `ALTERNATOR_LIMITS.md`.
3. **Entity/topic renames cascade** HA → MQTT → Signal K.
4. **Never commit real secrets.** Live file: `homeassistant/secrets.yaml` (gitignored). Template: `secrets.yaml.example`. Run `./scripts/scan_secrets.sh` before push.
5. **Hardware roles:** alts + levels = Marine Board; fridge = LilyGo S3 AMOLED; Spectra = WS @ `.25`. Do not reverse without explicit request.
6. **Bench T8-S3** is lab-only; never flash Marine Board packages onto it for vessel control.
7. Every GitHub issue you file must carry an accurate **Touches** field (real paths). That is the only parallel-safety signal other agents have.
8. **Production** Port/Starboard: `test_mode_enabled: "false"`.

---

## Issue kickoff (one-line user commands)

- **"do issue #N"** → `gh issue view N`; claim per §Parallel agents; execute to Acceptance boxes.
- **"pick next work"** → `gh issue list --state open`, excluding `agent:*` labels; highest priority first (**P1 > P2 > P3**, lowest number breaks ties); require concrete **Touches** and no unresolved `Depends on #N` in Notes.
- **"do all safety issues"** → same with `--label safety-critical` (or label the user names).
- **"do all firmware issues"** → `--label firmware`.

Label vocabulary:

| Kind | Labels |
| --- | --- |
| Type | `bug` · `enhancement` · `chore` · `documentation` |
| Priority | `P1` · `P2` · `P3` |
| Domain | `firmware` · `ha` · `vessel-ops` · `safety-critical` · `network` |
| Claim | `agent:grok` · `agent:claude` · `agent:codex` · `agent:<name>` |
| Archive | `historical` (closed snapshots; never reopen as work) |

**No "claimable" label** — **Touches** is the vetting signal. When filing a bug mid-task, write Touches before anything else.

While batching: claim before code; verify green per issue; respect Touches overlap + bad pairs; if blocked, comment why and move on.

---

## Parallel agents (local CLIs)

Multiple agents may work in the **same clone** or in **git worktrees**. Coordination is via GitHub issue labels + **Touches** fields — not chat.

### Claim protocol

1. `gh issue list --state open` — skip anything with `agent:*` or unresolved `Depends on #N`.
2. Compare **Touches** of your candidate against every claimed issue. Overlap → pick another.
3. Claim: `gh issue edit <N> --add-label agent:<you>` + one-line comment.
4. **Claim before code.** Never take another agent's label unless idle >1 session **and** the user reassigns.

### Disjoint scope

No two claimed issues may overlap in **Touches**.

**Single-owner hotspots** (at most one claimed issue may list these per wave):

| Hotspot | Why |
| --- | --- |
| `homeassistant/esphome/packages/marine_alternator.yaml` | Shared PID / hard ceilings |
| `homeassistant/esphome/packages/marine_board_base.yaml` | Shared board package |
| `homeassistant/automations.yaml` | MQTT republish map |
| `homeassistant/configuration.yaml` | HA entry / dashboards registration |
| `homeassistant/docker-compose.yml` | F8 stack topology |
| `homeassistant/docs/ALTERNATOR_LIMITS.md` | Limits policy authority |
| `.ai_context/naming.md` | Naming authority |
| `.ai_context/safety.md` | Safety invariants |
| `scripts/ha-*.sh` / `scripts/scan_secrets.sh` | Shared ops tooling |
| `NETWORK.md` / `OPS.md` | Vessel network & ops |

**Bad pairs** (same wave, even if paths look disjoint):

- Alternator firmware ∥ alternator dashboard bands / limits doc (coordinate or sequence)
- MQTT automations ∥ Signal K plugin map (`signalk-mqtt-sensors`)
- Freezer YAML ∥ shared secrets example key renames
- Anything ∥ wholesale `.gitignore` / secrets-policy rewrites

### Worktrees (preferred isolation)

```bash
git worktree add ../SisuAssistant-<N> -b issue-<N>
# work in ../SisuAssistant-<N>, verify, then merge/PR to main
```

One agent per worktree when possible. In a **shared** working tree: scoped `git add` only your files — never `git add -A`.

### Hand-off

1. Comment on the issue (verify commands + result, files touched, blockers).
2. Close if done; always `gh issue edit <N> --remove-label agent:<you>`.
3. Update INDEX **NEXT** if priorities shifted.
4. Commit + push per §6 (scoped add).

---

## Shell / command practices

- Prefer project scripts under `scripts/` for multi-step ops (SSH, deploy, secret scan).
- Do not echo live secrets into logs or issue comments.
- Absolute paths for captures when agents share a machine.

### Default post-task checks

| Script / command | When |
| --- | --- |
| `./scripts/scan_secrets.sh` | Every commit/push path |
| `esphome config <device.yaml>` | Any ESPHome change |
| `./scripts/ha-deploy-config.sh` | HA YAML deploy (vessel) |
| `docker compose -f homeassistant/docker-compose.yml config` | Compose / stack change |

### Agent deploy helpers

| Script | Purpose |
| --- | --- |
| `scripts/ha-ssh.sh` | SSH to HA Green (key preferred) |
| `scripts/ha-deploy-config.sh` | Push selected config to Green |
| `scripts/ha-cli.sh` | HA CLI helpers |
| `scripts/ha-scp.sh` | SCP helper |
| `scripts/scan_secrets.sh` | Pre-push secret leakage scan |

New operator-heavy patterns → new script + row here.

---

## Key source paths (not context)

| What | Where |
| --- | --- |
| Alt control + hard ceilings | `homeassistant/esphome/packages/marine_alternator.yaml` |
| Shared Marine Board | `homeassistant/esphome/packages/marine_board_base.yaml` |
| Port / Starboard entry | `homeassistant/esphome/alternator{port,starboard}.yaml` |
| Levels | `homeassistant/esphome/waterlevels.yaml` |
| Freezer (LilyGo) | `homeassistant/esphome/freezer.yaml` |
| Lab dual-alt sim | `homeassistant/esphome/bench_alts_sim.yaml` |
| Limits policy | `homeassistant/docs/ALTERNATOR_LIMITS.md` |
| MQTT republish | `homeassistant/automations.yaml` |
| Spectra bridge | `homeassistant/python_scripts/spectra_ws.py`, `packages/spectra_newport.yaml` |
| Vessel board UI | `homeassistant/ui-lovelace.yaml`, `dashboards/*.yaml` |
| Secrets (live / template) | `homeassistant/secrets.yaml` (gitignored) / `secrets.yaml.example` |
| Network / install / ops | `NETWORK.md`, `INSTALLATION.md`, `OPS.md` |
