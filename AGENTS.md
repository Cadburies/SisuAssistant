# AGENTS.md — Sisu Marine Automation

Token-efficient instructions for any coding agent. Prefer path pointers over copied source.
Full claim / parallel / verify / commit protocol: **`CLAUDE.md`**.

## Hardware roles (do not reverse)

| Function | Platform |
|----------|----------|
| Alternators (Port / Starboard) | **Sisu Marine Board** — ESP32-S3-WROOM-2-N32R16V |
| Tank / water levels | **Sisu Marine Board** — ESP32-S3-WROOM-2-N32R16V |
| Freezer / fridge | **LilyGo S3 AMOLED** (for now — do not move to Marine Board without explicit request) |
| HA + MQTT kernel (`sisu/v1`) + NMEA ingest | **HA Green** (Ethernet) |
| Signal K / Grafana / Influx | **TerraMaster F8** (Ethernet; Mac interim until #6) |
| Helm gauges (planned) | **Veratron OL43** via NMEA 2000 |
| Chart / weather routing (planned) | **Sisu Nav** Docker on F8/Mac — `sisu-nav/` · **#76–#79** · **`Sisu-Nav-Grok.md`** |

Network: **`NETWORK.md`** — GL-BE9300; HA **192.168.0.20**; TNAS **192.168.0.21**; ESPs **192.168.10.41–44**; lab bench **.49**.  
Ops: **`OPS.md`**. Scripts: `scripts/ha-ssh.sh`, `scripts/ha-deploy-config.sh`, `scripts/ha-cli.sh`, `scripts/scan_secrets.sh`.  
**Install / wiring / commission:** **`INSTALLATION.md`**.  
**Alternator limits:** `homeassistant/docs/ALTERNATOR_LIMITS.md`. Naming: `.ai_context/naming.md`.

## Session budget (mandatory)

Every session:

1. Read **`.ai_context/INDEX.md` only** first.
2. Open **at most 2** topical files from the Read-Next table (prefer sections).
3. Open **relevant source** for the task.
4. **Never** auto-load: archive, full long specs dump, README dump, or `node_modules`.
5. **Backlog:** GitHub Issues only — `gh issue list --state open` (claim/close cycle in `CLAUDE.md`).

Target: **under ~300 lines** of context markdown before source for a typical feature task.

## Context tiers

| Tier | What | When |
|------|------|------|
| **A** | `INDEX.md` | Always |
| **B** | Topical warm files under `.ai_context/` | Only if Read-Next maps the task |
| **C** | Source of truth (YAML, compose, plugins) | Always for implementation |
| **Cold** | `archive/`, long specs, closed issues | Never session-load; history = git + GitHub |

**Do not create Tier C mirrors.** If you find a mirror, delete it and replace with a path pointer.

## Task loop (full detail: `CLAUDE.md`)

1. **Pick & claim** — `gh issue list` / `gh issue view N`; claim with `agent:<you>` **before any code** (§1).
2. **Plan** — files + acceptance; re-read safety/limits or data_flow sections if electrical/MQTT.
3. **Implement** — smallest change; cascade HA → MQTT → Signal K when renames apply.
4. **Verify** — `./scripts/scan_secrets.sh` + `esphome config` / compose / live smoke as applicable (§4). Must be green.
5. **Close cycle** — comment verify result → close issue if done → **remove** `agent:<you>` → update INDEX NEXT / `risks.md` → scoped commit + push (§5–§6). Never re-open a markdown backlog.

## Project verify (use what exists)

```bash
./scripts/scan_secrets.sh

# Agent → HA Green (preferred on vessel)
./scripts/ha-ssh.sh 'ls /config/esphome'
./scripts/ha-deploy-config.sh

# ESPHome compile (Mac CLI or HA ESPHome app)
esphome config homeassistant/esphome/alternatorport.yaml
esphome compile homeassistant/esphome/alternatorport.yaml
# Levels: esphome config homeassistant/esphome/waterlevels.yaml
# Freezer (LilyGo AMOLED): esphome config homeassistant/esphome/freezer.yaml

# F8 Docker stack (when TNAS is production host)
docker compose -f homeassistant/docker-compose.yml config
```

There is **no** unit-test suite. Validation = secret scan + compile ESPHome configs + HA/MQTT/Signal K live smoke + safety review for electrical control changes.

**Lab:** optional T8 connectivity `bench_t8s3.yaml` only. Production alts/levels stay **Marine Board**; freezer stays **LilyGo S3 AMOLED**. Spectra = real machine via WS @ `.25`.

## Parallel agents (summary)

Full rules: **`CLAUDE.md`** §Pick & claim, §Closing cycle, §Parallel agents.

- Backlog = open GitHub Issues with concrete **Touches**; skip `agent:*` and unresolved `Depends on #N`.
- Claim before code → verify green → comment → close → remove claim → scoped push (never `git add -A`).
- Prefer `git worktree add ../SisuAssistant-<N> -b issue-<N>`.

## Hard rules

1. **Non-derivable only** in `.ai_context/`. If one source file answers it, write a path pointer.
2. **Safety-critical alternator control** lives in `esphome/packages/marine_alternator.yaml`. Do not weaken hard cutoffs (`ALT_I_CEIL`, `ALT_T_CEIL`, `HOUSE_V_CEIL`) without explicit human approval.
3. **Never commit real secrets.** Prefer `!secret` / `secrets.yaml`. Run `./scripts/scan_secrets.sh` before push.
4. **Open risks only** in `risks.md`; delete resolved rows. **Open work** = GitHub Issues.
5. **Hot/cold history**: git log + closed issues; never route agents to `archive/`.
6. **Do not** rebuild full entity inventories, PID code dumps, or sensor field catalogs in markdown.
7. **Shadow** (`switch.shadow_sw`) defaults ON (field forced 0). Leave it on until I/V/T are checked against the existing regulator. Never drive field until Shadow is OFF and the field wire is on this board.
8. **Fridge stays on LilyGo S3 AMOLED** until explicitly redesigned.
9. **Bench T8-S3** is lab-only connectivity; never reuse Marine Board packages on it for vessel control.
10. Every filed issue needs accurate **Touches** (parallel-safety signal).
11. **One public name per quantity** (`.ai_context/sources.md`). No new `_live`/`_slow` twins. Source order: YDWG → DataHub → boat box → internet → derive. Grafana rate limits = downsample view, not a second HA entity.

## Product (one line)

Yacht **Sisu**: Marine Board (alts + levels) + LilyGo AMOLED freezer + HA + MQTT + Signal K.

## Self-heal

- Contradictions in decision docs → fix immediately from source.
- Found mirror of source → delete mirror; leave path.
- Self-heal **must not** reintroduce field/entity catalogs or obsolete LilyGo-T7/MDDS60/ADS1115 alt paths as current design.
