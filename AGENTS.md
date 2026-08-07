# AGENTS.md — Sisu Marine Automation

Token-efficient instructions for any coding agent. Prefer path pointers over copied source.
Full claim / parallel / verify / commit protocol: **`CLAUDE.md`**.

## Hardware roles (do not reverse)

| Function | Platform |
|----------|----------|
| Alternators (Port / Starboard) | **Sisu Marine Board** — ESP32-S3-WROOM-2-N32R16V |
| Tank / water levels | **Sisu Marine Board** — ESP32-S3-WROOM-2-N32R16V |
| Freezer / fridge | **LilyGo S3 AMOLED** (for now — do not move to Marine Board without explicit request) |
| HA | **HA Green** (Ethernet) |
| MQTT / Signal K / Grafana | **TerraMaster F8 SSD Plus** (Ethernet) |
| Helm gauges (planned) | **Veratron OL43** via NMEA 2000 |

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
5. **Backlog:** `gh issue list --state open` — not a markdown outstanding file.

Target: **under ~300 lines** of context markdown before source for a typical feature task.

## Context tiers

| Tier | What | When |
|------|------|------|
| **A** | `INDEX.md` | Always |
| **B** | Topical warm files under `.ai_context/` | Only if Read-Next maps the task |
| **C** | Source of truth (YAML, compose, plugins) | Always for implementation |
| **Cold** | `changelog.md`, `archive/`, long specs, closed issues | Never session-load; history = git + GitHub |

**Do not create Tier C mirrors.** If you find a mirror, delete it and replace with a path pointer.

## Task loop

1. **Pick & claim** a GitHub issue (or user one-off) per **`CLAUDE.md`** §1 — claim with `agent:<you>` **before code**.
2. **Locate source** via layout map / grep; do not invent entity IDs.
3. **Change** source; keep safety invariants (see `.ai_context/safety.md`).
4. **Cascade check**: entity rename → HA automation → MQTT topic → Signal K plugin map.
5. **Verify**: `./scripts/scan_secrets.sh` + relevant `esphome config` / HA / compose (see `CLAUDE.md` §4).
6. **Memory hygiene**:
   - Update INDEX NEXT if priority shifted.
   - Delete resolved rows from `risks.md` only.
   - Comment + close the GitHub issue; remove `agent:<you>` claim label.
   - Fix contradictions in decision docs immediately; never reintroduce field tables.
7. **Commit & push** scoped files only (never `git add -A` in a shared tree) once verify is green.

## Project verify (use what exists)

```bash
./scripts/scan_secrets.sh

# Agent → HA Green (preferred on vessel)
./scripts/ha-ssh.sh 'ls /config/esphome'
./scripts/ha-deploy-config.sh

# ESPHome compile (Mac CLI or HA ESPHome app)
esphome config homeassistant/esphome/bench_t8s3.yaml
esphome config homeassistant/esphome/alternatorport.yaml
esphome compile homeassistant/esphome/alternatorport.yaml
# Levels: esphome config homeassistant/esphome/waterlevels.yaml
# Freezer (LilyGo AMOLED): esphome config homeassistant/esphome/freezer.yaml

# F8 Docker stack (when TNAS is production host)
docker compose -f homeassistant/docker-compose.yml config
```

There is **no** unit-test suite. Validation = secret scan + compile ESPHome configs + HA/MQTT/Signal K live smoke + safety review for electrical control changes.

**Lab:** LilyGo **T8-S3** → `bench_alts_sim.yaml` dual-alt sim @ `.49`. Production alts/levels stay **Marine Board**; freezer stays **LilyGo S3 AMOLED**. Spectra = real machine via WS @ `.25`.

## Parallel agents (summary)

Full rules: **`CLAUDE.md` §Parallel agents**.

- Backlog = open GitHub Issues with concrete **Touches**; skip `agent:*` claims.
- Claim: `gh issue edit <N> --add-label agent:<you>` + comment **before code**.
- No overlapping **Touches**; single-owner hotspots include `marine_alternator.yaml`, `automations.yaml`, `configuration.yaml`, limits/safety/naming docs, deploy scripts.
- Prefer `git worktree add ../SisuAssistant-<N> -b issue-<N>`.
- Hand-off: comment, close, remove claim label, scoped commit + push.

## Hard rules

1. **Non-derivable only** in `.ai_context/`. If one source file answers it, write a path pointer.
2. **Safety-critical alternator control** lives in `esphome/packages/marine_alternator.yaml`. Do not weaken hard cutoffs (`ALT_I_CEIL`, `ALT_T_CEIL`, `HOUSE_V_CEIL`) without explicit human approval.
3. **Never commit real secrets.** Prefer `!secret` / `secrets.yaml`. Run `./scripts/scan_secrets.sh` before push.
4. **Open risks only** in `risks.md`; delete resolved rows. **Open work** = GitHub Issues.
5. **Hot/cold history**: git log + closed issues; never route agents to `archive/`.
6. **Do not** rebuild full entity inventories, PID code dumps, or sensor field catalogs in markdown.
7. **Production**: `test_mode_enabled` must stay `"false"` on Port/Starboard wrappers unless deliberately bench-testing.
8. **Fridge stays on LilyGo S3 AMOLED** until explicitly redesigned.
9. **Bench T8-S3** is lab-only; never reuse Marine Board packages on it for vessel control.
10. Every filed issue needs accurate **Touches** (parallel-safety signal).

## Product (one line)

Yacht **Sisu**: Marine Board (alts + levels) + LilyGo AMOLED freezer + HA + MQTT + Signal K.

## Self-heal

- Contradictions in decision docs → fix immediately from source.
- Found mirror of source → delete mirror; leave path.
- Self-heal **must not** reintroduce field/entity catalogs or obsolete LilyGo-T7/MDDS60/ADS1115 alt paths as current design.
