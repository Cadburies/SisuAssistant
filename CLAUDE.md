# Sisu Assistant — AI Project Instructions

> Project-specific runtime contract for any coding agent (Claude, Grok, Codex, …).
> Orientation router: `.ai_context/INDEX.md`. Compact hard rules: `AGENTS.md`.

## Session start (token budget)

1. Read `.ai_context/INDEX.md` only (≤ ~100 lines).
2. From its **Read-Next** table, load **at most 1–2** topical files (prefer **named sections**).
3. Prefer **source of truth** (YAML / scripts / compose / plugins) over inventory docs.
4. **Never** load by default: `.ai_context/archive/*`, full long specs dumps, `node_modules`, changelog history.

**Budget:** INDEX + ≤2 topical files + relevant source. Exceed only if blocked.

Do not invent entity IDs, MQTT topics, or Signal K paths — derive from source.

**Open backlog = GitHub Issues only.** List with `gh issue list --state open`. There is no markdown backlog file.

---

## What belongs in context (tiers)

| Tier | Content | Maintain? |
| --- | --- | --- |
| **A** | Decisions, safety invariants, open risks, `INDEX` NEXT | Yes — keep accurate |
| **B** | Cross-file synthesis (data flow, naming, displays, secrets policy) | Yes if wrong |
| **C** | Derivable inventory (entity lists, field catalogs, PID dumps) | **Do not maintain** — path pointer only |
| **D** | History | `git log` + **closed GitHub issues**; cold snapshots in `archive/` — never session-load |

**Golden rule:** context holds *non-derivable* truth only. If one source file answers it, write a path pointer, not a second copy.

---

## Self-heal (continuous, narrow)

When reading source that **contradicts a Tier A/B claim**, fix the context file immediately (one sentence in the reply is enough).

- Do **not** expand silence into entity catalogs or code dumps.
- If you catch yourself updating a mirror of source, **delete that section** and leave a path pointer.
- Resolved risks: **delete** the row from `risks.md` (never long-lived `~~strikethrough~~`).
- **Feature Map** (`.ai_context/feature_map/`): Tier B, grep-only, **never session-load**. A change that adds/removes/moves a dashboard card, Sisu Nav plugin/route, or ESPHome control updates the matching `<feature>.md` + `<feature>.sh` pair in the same change (format: `DESIGN.md`; gate: `lint.sh`). The GitHub wiki is **generated** from it on push (`.github/workflows/feature-map-wiki.yml`; local `wiki.sh`) — never edit wiki pages.
- Closed work: **close the GitHub issue** — never re-create a parallel backlog file.

### Onboarding docs (README.md / Technical Specifications.md / INSTALLATION.md)

These three are what a new person (or agent) reads **first**, before `.ai_context/`, to understand what this project is, what the hardware/system spec is, and how to install/commission it. They must stay accurate without anyone having to remember to update them.

**Self-heal trigger:** whenever a change alters something these files claim — a hardware role, a network/topology fact, an install/commission step, a doc path, a stack component moving host (e.g. interim Mac ↔ F8) — update the affected file(s) in the **same change**, not as separate follow-up work. This applies whether the triggering change is code, config, or a live-system decision (e.g. "F8 interim on Mac" needed updating README's stack diagram, `Technical Specifications.md`'s system overview, and `INSTALLATION.md`'s commissioning order — three small edits, one change).

- **README.md** — project overview, platform roles, doc index, network summary, high-level install steps. Keep it short; link out (`INSTALLATION.md`, `NETWORK.md`, `OPS.md`, `MarineBoard/`) rather than duplicating detail.
- **`Technical Specifications.md`** — system-level functional spec. For fast-changing implementation detail (control-loop constants, entity lists, live setpoints) **point at the source file** (`packages/marine_alternator.yaml`, `.ai_context/safety.md`) instead of re-describing it — that's what caused it to go stale before; a pointer can't drift, a copy always eventually does.
- **`INSTALLATION.md`** — wiring/commission manual; already has its own §14 "Document maintenance" — follow it.
- **`MarineBoard/`** — the KiCad hardware project (schematic, PCB, BOM). Reference it with a real markdown link (`[MarineBoard/Technical Specs.md](MarineBoard/Technical%20Specs.md)`, URL-encode the space), not bare backtick text — a broken/unclickable path is as good as no reference. The folder is named `MarineBoard/`, not `MarineBoardSpecs/`.
- Bump the version/date line and add one Revision History row when the change is significant enough to matter to someone reading top-to-bottom.
- Commit and push these alongside the change that triggered the update — they're git-tracked project docs, not `.ai_context/` session notes.

### Sisu Nav docs (`sisu-nav/INSTALLATION.md` / `USER_GUIDE.md` / `DEVELOPER.md`)

Same idea, scoped to the `sisu-nav/` app: an install/deploy doc, an end-user doc, and a developer doc (API routing + plugin architecture). `sisu-nav/README.md`'s plugin table stays a short Tier-C index (id → one line → issue) — these three carry the actual prose, and self-heal is what stops them drifting from it.

**Self-heal trigger:** adding, modifying, or removing a `web/src/plugins/<id>/` plugin or an `api/<feature>/` route updates the affected doc(s) **in the same change**:

- New/changed **user-visible behavior** (a panel, a map layer, a control) → `USER_GUIDE.md`.
- New/changed **plugin wiring or API route** (`NavPlugin` shape, `layers.ts` registration, `server.mjs` route table, a new `api/<feature>/` module) → `DEVELOPER.md`.
- New/changed **env var, secret, port, or compose service** → `INSTALLATION.md`.
- A plugin or route is **removed** → delete its mentions from all three, and from `sisu-nav/README.md`'s table.
- A single feature commonly touches two of the three (e.g. a new plugin is both a user-visible panel and a developer wiring example) — update both in that commit, not as a follow-up.

Point at source (`web/src/plugins/map/layers.ts`, `api/server.mjs`) rather than re-listing derivable detail (full catalog IDs, full route list) — same "path pointer over copy" rule as above.

**Personal-use scope, not a commercial app:** Sisu Nav (and Sisu Assist as a whole) is personal use only, currently private, may go public later — repo visibility has no bearing on any third-party API's terms of service either way. Tile-provider ToS decisions (which providers `api/harvest/providers.yaml` allows, and why) live entirely in that file's header comment — don't duplicate the reasoning here, and don't reintroduce a blanket "no Mapbox/Google/Bing/Apple" ban from memory or by applying normal commercial-app ToS caution; read `providers.yaml` for the current, deliberately-decided policy before changing it.

---

## How a task works

### 1. Pick & claim (before any planning or code)

1. Resolve what the task actually is:
   - explicit ask (`do issue #N`),
   - batch/sequence (`pick next work` / `do all safety issues` / `do all firmware issues` → `gh issue list --state open`, highest priority first — **P1 > P2 > P3**, lowest number breaks ties),
   - or a one-off the user just typed (file a GitHub issue first if the work is non-trivial — see §Filing issues).
   See §Issue kickoff for command shorthand.
2. There is **no "claimable" label**. Workability is judged from the issue’s **Touches** field (real paths, not placeholders) and Notes (skip anything with an unresolved `Depends on #N`).
3. Before claiming, check in-flight work: `gh issue list --state open` and skip any open issue already carrying an `agent:*` label — that is another agent in this shared tree.
4. Check **parallel safety** against **every** currently claimed issue: no overlap in **Touches**, not a listed bad pair, and not a single-owner hotspot another claim already owns (see §Parallel agents). If it collides, pick a different task — never guess and proceed.
5. Claim it **first, before writing any code**:
   ```bash
   gh issue edit <N> --add-label agent:<you>
   gh issue comment <N> --body "Claimed by <you>. Parallel-safe vs open claims: <why>."
   ```
   Only once the claim lands, move to Plan. `<you>` examples: `grok`, `claude`, `codex`.

### 2. Plan

- Short bullet list: change, files, acceptance criteria (mirror the issue Acceptance boxes).
- Electrical / alternator / ENBL / limits → re-read matching section of `safety.md` + `homeassistant/docs/ALTERNATOR_LIMITS.md` (not whole files if avoidable).
- MQTT / Signal K / entity renames → re-read matching section of `data_flow.md` / `risks.md`; plan cascade **before** coding.
- Network / deploy → `NETWORK.md` / `OPS.md` only if the issue needs vessel access.

### 3. Implement

- Smallest change that meets the requirement. No drive-by refactors.
- Comments only for non-obvious *why*.
- Prefer `!secret` / `secrets.yaml` for any credential; never inline passwords or API keys.
- First commission: leave **Shadow measure-only** ON (field forced 0) until sensors check out.
- **Cascade in the same change** when relevant:
  | Layer | Touch |
  | --- | --- |
  | ESPHome entity / name | device YAML + packages |
  | HA | automations, packages, dashboards, templates |
  | MQTT topic / JSON key | `automations.yaml` publish map |
  | Signal K path | `homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json` (authoritative tree under `homeassistant/signalk/`) |
  | Limits policy | `docs/ALTERNATOR_LIMITS.md` if scale/hard/SP text changes |
  | Sisu Nav plugin / API route | `sisu-nav/USER_GUIDE.md` (behavior) + `sisu-nav/DEVELOPER.md` (wiring); `sisu-nav/INSTALLATION.md` too if env/secret/port/compose changes; `sisu-nav/README.md` table |

### 4. Verify (mandatory after every task — no unit-test suite)

This project has **no** `flutter test` / host suite. The gate is **stack verify** for what you touched. **Must be green before claiming done.**

```bash
# Always (every issue that produces a commit)
./scripts/scan_secrets.sh

# ESPHome — run config for every device/package path you changed
esphome config homeassistant/esphome/alternatorport.yaml
esphome config homeassistant/esphome/alternatorstarboard.yaml
esphome config homeassistant/esphome/waterlevels.yaml
esphome config homeassistant/esphome/freezer.yaml
esphome config homeassistant/esphome/saloon_display.yaml
# Optional compile when logic in packages changed:
# esphome compile homeassistant/esphome/alternatorport.yaml

# Compose / F8 stack topology
docker compose -f homeassistant/docker-compose.yml config

# Vessel live smoke (when HA Green / F8 reachable — skip only if offline; note in issue comment)
./scripts/ha-ssh.sh 'ls /config/esphome'
# ./scripts/ha-deploy-config.sh   # when the task requires deploy
```

#### Verify map (what to run for which change)

| Touched area | Minimum verify |
| --- | --- |
| Any commit | `./scripts/scan_secrets.sh` |
| `esphome/**` packages or devices | `esphome config` on affected entry YAMLs |
| Hard ceilings / PID / ENBL | config + re-read `ALTERNATOR_LIMITS.md`; **no** ceiling weaken without human approval |
| `automations.yaml` / MQTT | config + (live) test publish if broker up |
| `signalk/**` plugin maps | compose config + (live) SK path check if F8 up |
| Any `homeassistant/{configuration,automations,scripts,scenes,secrets}.yaml`, `packages/*`, `python_scripts/*`, `dashboards/*`, `themes/*`, `www/*` | **Mandatory when HA Green is reachable** — see "HA Green deploy" below. Not optional/best-effort; "git push" alone does **not** make a HAOS-side change live. |
| `docker-compose.yml` / mosquitto | `docker compose … config` |
| Secrets-adjacent | scan_secrets + confirm `secrets.yaml` still gitignored |

**Safety-critical** (`marine_alternator.yaml`, hard ceilings): extra human review before OTA to **production** boards. Do not weaken `ALT_I_CEIL` / `ALT_T_CEIL` / `HOUSE_V_CEIL` without explicit approval.

#### HA Green deploy (mandatory for any HAOS-side file, not just an optional extra)

A git commit changes this repo. It does **not** change what HA Green is actually running — that's a separate box with its own `/config`, updated only by explicit deploy. Treat "deployed to HA Green + config-checked" with the same weight as "committed to GitHub" for any file under the paths above: a git-only change to a HAOS file is an **unfinished task**, not a deferred nice-to-have.

1. `./scripts/ha-deploy-config.sh <file1> <file2> ...` — **pass the exact files you touched as arguments.** The no-argument form only pushes a small curated legacy list (see `DEFAULT_FILES` in the script) that does **not** cover most packages/dashboards/python_scripts — relying on it silently skips real files. The script self-verifies byte-for-byte after each file (reports `ERROR: size mismatch` if a transfer failed) — do not treat "no error printed" alone as proof; read its output.
2. `./scripts/ha-cli.sh core check` — HAOS's own full-config validation via Supervisor (`ha core check`), the closest equivalent to `esphome config`/a compile check for HA. Run it **after** deploying, before telling the user it's done or asking them to restart. `docker exec`-based; needs Supervisor protection mode off (already the case per `OPS.md` §4.2) or it silently no-ops — a bare "Command completed successfully" with no config summary is suspicious, cross-check against a known-bad config once if you've never run it in a session before.
3. If a `homeassistant:` top-level block changed (rare — `configuration.yaml` itself), a package/dashboard/script file needs a **Core restart** to be loaded (packages parse at startup; YAML-mode dashboards usually don't need one, but don't assume). **A HAOS/Core restart is safe to trigger yourself as a normal closing step — do not hold back or ask first.** No HA automation is currently safety-critical, and nothing safety-critical depends on HA staying up: alternator control, hard cutoffs, and every other safety-relevant function run entirely locally on their own ESP32 firmware, independent of HA (see `safety.md`). A restart briefly interrupts dashboards/automations/history, not vessel safety. Prefer the smallest sufficient action first (a scoped `*.reload` service call via the API — `template.reload`, `automation.reload`, etc. — reloads just that platform without the full interruption) but do a full Core restart without hesitation when the change actually needs one (new package file, `homeassistant:` block, new integration).
4. Before deploying anything: confirm HA Green is reachable (`ping 192.168.0.20` or equivalent) and validate syntax first — plain YAML files with the venv/pyyaml check, `configuration.yaml` itself is better validated by step 2 (`ha core check`) since it uses HA-specific tags (`!include`, `!secret`) a generic parser will reject.
5. **Audit for drift, don't assume "I deployed once so we're in sync"** — a file can drift because a previous session/agent edited it and forgot this step. When touching any file in the path list above, it's worth a quick `sha256sum` compare (local vs `ssh ... sudo sha256sum /config/<path>`) if there's any doubt, not just for the file you're actively editing but neighboring files in the same package/dashboard you're about to build on top of.
6. **Never blanket-deploy every out-of-sync file you happen to find.** If an audit turns up drift in a file you did **not** touch, that may be another agent's in-progress work — flag it to the user/issue thread rather than silently pushing it live, same spirit as the git `git add -A` prohibition in §Parallel agents.

Offline / no vessel: still run scan_secrets + esphome config + compose config; comment the issue with what was skipped and why (this now includes "HA Green deploy skipped — vessel unreachable").

### 5. Update context (end of task)

1. Update **Tier A/B** files actually affected (not every file).
2. Cap `INDEX.md` → **NEXT** at ~6 lines (last / doing / blockers / next issue numbers).
3. **Close or comment** the GitHub issue: verify commands + result (what ran / what skipped), files touched, blockers. History = **git log + issue threads** — do not maintain a markdown backlog.
4. Remove the claim: `gh issue edit <N> --remove-label agent:<you>` (closing the issue leaves the label attached otherwise, which reads as still-claimed to the next session’s §1 check).
5. Delete resolved rows from `risks.md` only.

### 6. Commit & push (closing rule — only once verify is green)

Once §4 is green and §5 is done, commit and push **without waiting for a separate ask** — a green verify is the trigger, not a reason to pause for confirmation:

1. `git add` the **specific files the task touched** (source + Tier A/B context updated in §5) — **never** blanket `git add -A`; that risks sweeping up another agent’s in-progress edits in a shared tree (see §Parallel agents).
2. Commit with a message describing the change and why (include `#N` when applicable).
3. `git push origin <current-branch>`. If rejected (remote moved): `git fetch` + rebase/merge and retry — **never force-push** to `main`.
4. **If any touched file is a HAOS-side path** (see §4's verify map list) **and HA Green is reachable: run the HA Green deploy steps too** (§4 "HA Green deploy") — same commit, same closing pass, not a follow-up. A git push alone leaves the live box unchanged; do not report the task done until both sides match.
5. Skip git push only if verify is not green, the user asked to hold off, or the task was pure investigation/read-only with no diff. Skip the HA Green deploy sub-step only if the vessel is genuinely unreachable — say so explicitly, don't silently omit it.

---

## Closing cycle (checklist)

When finishing an issue, in order:

```text
[ ] §4 verify green for touched stack (scan_secrets + esphome/compose/live as applicable)
[ ] HAOS files touched? -> ha-deploy-config.sh <files> -> ha-cli.sh core check -> reload/restart if needed   # §4 HA Green deploy — not optional; restart is safe, don't defer it
[ ] §5 context: risks/INDEX/safety only if needed
[ ] gh issue comment: verify result, files, skips, blockers
[ ] gh issue close <N>          # if acceptance met
[ ] gh issue edit <N> --remove-label agent:<you>
[ ] scoped git add → commit (#N) → push
```

If **blocked** (hardware, Depends on #N, vessel offline for a live-only acceptance box): comment why, leave issue open, remove claim label, pick next work — never flail.

---

## Filing issues (onboarding new work)

Every GitHub issue — human or agent (bug found mid-task, follow-up) — **must** use the template shape:

| Field | Required | Purpose |
| --- | --- | --- |
| **Task** | Yes | What/why; enough to start without asking |
| **Touches** | Yes | Real paths the work will change — **only** parallel-safety signal |
| **Acceptance** | Yes | Checkboxes agents close against |
| **Notes** | If needed | `Depends on #N`, bad pairs, human/vessel needs |

```bash
# Prefer the repo template
gh issue create --title "…" --label "enhancement,P2,firmware" --body-file - <<'EOF'
## Task
…

## Touches
- `homeassistant/esphome/packages/marine_alternator.yaml`

## Acceptance
- [ ] …
- [ ] `./scripts/scan_secrets.sh` green

## Notes
Depends on #N (if any)
EOF
```

A vague or missing **Touches** field blocks safe parallel work — write it before anything else when filing.  
**Never** log open work in markdown under `.ai_context/`; file or update a GitHub issue instead.

---

## Mandatory rules

1. **Non-derivable only** in `.ai_context/`. Path pointers over copies.
2. **Alternator hard cutoffs sacred** (250 A / 14.4 V / 125 °C). Change only with human approval + update `ALTERNATOR_LIMITS.md`.
3. **Entity/topic renames cascade** HA → MQTT → Signal K in the same change when possible.
4. **Never commit real secrets.** Live: `homeassistant/secrets.yaml` (gitignored). Template: `secrets.yaml.example`. Run `./scripts/scan_secrets.sh` before push. **Whenever a key is added, removed, or renamed in `secrets.yaml`, mirror it into `secrets.yaml.example` in the same change** — placeholder value + one-line comment on what it's for and where to get/generate it, never a real value. `scan_secrets.sh` enforces key-set parity between the two files and fails the commit if they drift — this is what lets a follower clone the repo and know exactly what every variable is and where to find it, without asking.
5. **Hardware roles:** alts + levels = Marine Board; fridge = LilyGo S3 AMOLED; saloon guest display = Waveshare 4.3B; Spectra = WS @ `.25`. Do not reverse without explicit request.
6. **Lab GPIO mapping** is `bench_marine_board.yaml` on a Marine Board (not a vessel role). Do not flash production field YAML until shadow commission (`INSTALLATION.md` §6.4).
7. Every GitHub issue must carry accurate **Touches** (parallel-safety signal).
8. **Shadow** defaults ON (field forced 0) until I/V/T are checked; then OFF before this board drives field.
9. Authoritative Signal K config for deploy: **`homeassistant/signalk/`** (not root `signalk/` sample tree).
10. Self-heal Tier A/B only (see above).
11. **One name, instrument-first, per-signal priority** (`.ai_context/sources.md`). Never add `_live`/`_slow`/`_fast` twins — rate limits are a **consumer view** (e.g. Grafana `Sisu_1m`), not a second entity. Fill each quantity in order: **(1) YDWG** (law; liveness = NMEA received, not TCP open) → **(2) DataHub** (only if YDWG mute or this signal absent; do not trust `$IIMWD` >360°; no engines) → **(3) other boat box** (Victron BMV = house SoC; Spectra WS; ESP location V / tanks / alts) → **(4) internet** → **(5) derive** only if 1–4 cannot provide it. Before deriving, check the instrument already transmits it (`$YDMWD` TWD, XDR/MDA air+baro). House SoC ≠ ESP `house_v` ≠ YDWG `Alternator#`. Seed statistics from the most complete rooted source.

---

## Issue kickoff (one-line user commands)

Shorthand the user may give any agent at session start:

- **"do issue #N"** → `gh issue view N`; claim per §1 / §Parallel agents; execute to Acceptance boxes; full closing cycle.
- **"pick next work"** → `gh issue list --state open`, excluding `agent:*`; highest priority first (**P1 > P2 > P3**, lowest number breaks ties); require concrete **Touches** and no unresolved `Depends on #N` in Notes.
- **"do all safety issues"** → same with `--label safety-critical`.
- **"do all firmware issues"** → `--label firmware`.
- **"do all vessel-ops issues"** → `--label vessel-ops` (often human/hardware gated — skip if blocked and comment).

Label vocabulary:

| Kind | Labels |
| --- | --- |
| Type | `bug` · `enhancement` · `chore` · `documentation` |
| Priority | `P1` · `P2` · `P3` |
| Domain | `firmware` · `ha` · `vessel-ops` · `safety-critical` · `network` · `sisu-nav` |
| Claim | `agent:grok` · `agent:claude` · `agent:codex` · `agent:<name>` |
| Archive | `historical` (closed snapshots; never reopen as work) |

**No "claimable" label** — **Touches** is the vetting signal.

While batching: claim before code; verify green per issue (skips need justification in the issue comment); respect Touches overlap + bad pairs; if blocked, comment why and move on — never flail.

---

## Parallel agents (local CLIs)

Multiple agents may work in the **same clone** or in **git worktrees**. Coordination is via GitHub issue labels + **Touches** — not chat.

### Claim protocol

1. `gh issue list --state open` — skip `agent:*` or unresolved `Depends on #N`.
2. Compare **Touches** of your candidate against every claimed issue. Overlap → pick another.
3. Claim: `gh issue edit <N> --add-label agent:<you>` + one-line comment.
4. **Claim before code.** Never take another agent’s label unless idle >1 session **and** the user reassigns.

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
| `homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json` | SK path map |
| `.ai_context/naming.md` | Naming authority |
| `.ai_context/safety.md` | Safety invariants |
| `scripts/ha-*.sh` / `scripts/scan_secrets.sh` | Shared ops tooling |
| `NETWORK.md` / `OPS.md` | Vessel network & ops |

**Bad pairs** (same wave, even if paths look disjoint):

- Alternator firmware ∥ alternator dashboard bands / limits doc (sequence or one owner)
- MQTT automations ∥ Signal K plugin map (`signalk-mqtt-sensors`)
- Freezer YAML ∥ shared secrets example key renames
- Anything ∥ wholesale `.gitignore` / secrets-policy rewrites
- Production OTA to engine-room boards ∥ concurrent hard-ceiling edits

### Worktrees (preferred isolation)

```bash
git worktree add ../SisuAssistant-<N> -b issue-<N>
# work in ../SisuAssistant-<N>, verify, then merge/PR to main
```

One agent per worktree when possible. In a **shared** working tree: scoped `git add` only your files — never `git add -A`.

### Hand-off

1. Comment on the issue (verify result, skips, files touched).
2. Close if acceptance met; always remove `agent:<you>`.
3. Update INDEX **NEXT** if priorities shifted.
4. Commit + push per §6 (scoped add).

---

## Shell / command practices

- Prefer project scripts under `scripts/` for multi-step ops (SSH, deploy, secret scan).
- Do not echo live secrets into logs or issue comments.
- Absolute paths for captures when agents share a machine.
- Prefer putting multi-step pipelines in `scripts/*.sh` rather than fragile one-liners.

### Default post-task checks (via §4)

| Script / command | Purpose |
| --- | --- |
| `./scripts/scan_secrets.sh` | Secret leakage gate (every commit) |
| `esphome config <entry>.yaml` | ESPHome validity for touched devices |
| `esphome compile <entry>.yaml` | Optional; heavier, when package logic changed |
| `docker compose -f homeassistant/docker-compose.yml config` | F8 stack topology |
| `./scripts/ha-ssh.sh '…'` | Live HA Green when vessel reachable |
| `./scripts/ha-deploy-config.sh` | Deploy selected config to Green |

### Agent deploy helpers

| Script | Purpose |
| --- | --- |
| `scripts/ha-ssh.sh` | SSH to HA Green (key preferred) |
| `scripts/f8-ssh.sh` | SSH to the TerraMaster F8/TNAS (port **9222**, `f8_ssh_*` in `secrets.yaml`). Works from Sisu LAN (`192.168.0.0/24`); TOS does not accept SSH from Sisu-IoT |
| `scripts/f8-deploy.sh` | rsync `homeassistant/` + `sisu-nav/` (and, with `--secrets`, `secrets.yaml`/`.env`) to the F8 — F8's TOS blocks direct `apt`/`git`, so this Mac stays the build/push side, same "push from Mac" model as `ha-deploy-config.sh` |
| `scripts/ha-deploy-config.sh` | Push selected config to Green |
| `scripts/ha-cli.sh` | HA CLI helpers |
| `scripts/ha-scp.sh` | SCP helper |
| `scripts/scan_secrets.sh` | Pre-push secret leakage scan |
| `scripts/signalk-inject-mqtt-creds.sh` | Local-only: injects `secrets.yaml`'s MQTT password into the two SK plugin-config JSON files on disk (#74); never commit after running — `git checkout -- <path>` restores the safe baseline |

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
| Shadow / cal | `docs/ALTERNATOR_TUNING.md` + `INSTALLATION.md` §6.4 |
| Limits policy | `homeassistant/docs/ALTERNATOR_LIMITS.md` |
| MQTT republish | `homeassistant/automations.yaml` |
| Signal K (deploy) | `homeassistant/signalk/` |
| Spectra bridge | `homeassistant/python_scripts/spectra_ws.py`, `packages/spectra_newport.yaml` |
| Vessel board UI | `homeassistant/ui-lovelace.yaml`, `dashboards/*.yaml` |
| Secrets (live / template) | `homeassistant/secrets.yaml` (gitignored) / `secrets.yaml.example` |
| Network / install / ops | `NETWORK.md`, `INSTALLATION.md`, `OPS.md` |
| Sisu Nav (chart/weather/routing cockpit) | `sisu-nav/` · install: `sisu-nav/INSTALLATION.md` · usage: `sisu-nav/USER_GUIDE.md` · API/plugin dev: `sisu-nav/DEVELOPER.md` · issues label **sisu-nav** |
