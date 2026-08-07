# Changelog (hot)

**Policy:** Short, newest-first working memory of **behavior-relevant** changes.  
When this file exceeds ~40–60 lines, move older entries to `archive/YYYY.md` and leave a one-line pointer.

**Never session-load** this file or `archive/` unless the task is explicitly historical.

## Format

```
### YYYY-MM-DD — short title
- What changed (user/agent impact), path pointers only
```

## Entries

### 2026-08-07 — GitHub Issues only + full issue lifecycle
- Removed **`outstanding.md`** entirely; open work = GitHub Issues only.
- **`CLAUDE.md`**: SisuMate-style pick/claim → plan → implement → verify map → close cycle → scoped push, translated for HA / ESPHome / Signal K / Marine Board.
- Pre-GitHub snapshot cold only: `archive/2026-08-pre-github-backlog-snapshot.md`.

### 2026-07-27 — INSTALLATION.md + alt software backlog
- Added repo-root **`INSTALLATION.md`**: project overview, network summary, HA Green, Marine Board, alts (PWM/shunt/BMS), levels, freezer, Spectra, lab sim, commissioning.
- `outstanding.md`: software items **O21–O28** (ENBL/ATC, RPM gate, fault latch, faster hard trip, dual-alt budget, logging, BMS in HA, Alert).
- INDEX / AGENTS / OPS / README link to install manual.

### 2026-07-23 — AI context sync + limits + Lovelace 2026.8
- Docs: `ALTERNATOR_LIMITS.md` (3-layer scale/hard/SP); safety/risks/outstanding/INDEX/displays/data_flow aligned.
- Hard ceilings: **250 A / 14.4 V / 125 °C**; scale 320 A / 14.7 V / 150 °C; alt gauges + ESPHome + aliases.
- Lovelace: drop top-level `mode: yaml` → `resource_mode` + `dashboards.lovelace` → `ui-lovelace.yaml` (HA 2026.8).
- Spectra: autorun liters|hours, FWF retry, Water UI; dual Overview documented (core Home vs Sisu board).

### 2026-07-23 — Spectra Newport 400c WebSocket bridge
- Live bridge `python_scripts/spectra_ws.py` → `packages/spectra_newport.yaml`
- Commands START/STOP/FLUSH; autorun sequence; Water dashboard.

### 2026-07-23 — Dashboard polish: Overview zones, charge ETA, Power/Victron
- Home Overview: Engine room → Alternators; Power dashboard (Victron-style stubs).
- Charge card: summary + ETA; energy_victron_stubs for future N2K gateway.

### 2026-07-23 — Dual alternator lab simulator (T8-S3)
- Added `esphome/bench_alts_sim.yaml`: Port+Stbd live sim (stages, setpoints, ceilings, scenarios).
- Dashboard draft `dashboards/alternators_sim.yaml`. IP `.49`. Not production control.

### 2026-07-23 — Agent-first HA Green ops + T8-S3 bench
- HA Green reset; SSH + deploy scripts; configs pushed to `/config`.
- Added `OPS.md`, `scripts/ha-ssh.sh` / `ha-deploy-config.sh`, `esphome/bench_t8s3.yaml` (lab .49).
- Docs: INDEX, AGENTS, NETWORK 1.3, README, secrets.example, outstanding O11–O14.

### 2026-07-22 — Removed root alternator.yaml
- Flash only `alternatorport.yaml` / `alternatorstarboard.yaml` + packages; docs updated.

### 2026-07-22 — ESPHome packages refactor
- Added `packages/marine_board_base.yaml` + `marine_alternator.yaml`; entrypoints use packages.
- Archived `new_*` to `esphome/archive/`. HA names include · Port/Starboard for side-by-side; ids stay device-scoped.

### 2026-07-22 — Removed displaymain.yaml
- Deleted unused saloon RGB display config and doc references (helm = Veratron/HA, fridge = LilyGo).

### 2026-07-22 — Fixed IPs locked in
- HA **192.168.0.20**, TNAS **192.168.0.21**, ESPs **.41–.44** in secrets, ESPHome `manual_ip`, NETWORK/README/INDEX.

### 2026-07-22 — NETWORK.md: GL-BE9300 + IP plan
- GL-BE9300 actions, subnets, firewall, verification checklist.

### 2026-07-22 — NETWORK.md: Wi‑Fi 7, F8, helm, Grafana
- HA Green + F8, Sisu vs Sisu-IoT, Veratron OL43, Grafana+Influx.

### 2026-07-22 — Naming convention implemented project-wide
- ESPHome ids/names per `naming.md` (`house_v`, `alt_i`, `alt_i_sp`, `house_v_float`, `house_v_abs`, `fresh_aft_level`, …).
- HA automations + SK mqtt-sensors: port **and** starboard; house voltage paths `batteries.house.voltage.{port,starboard,saloon}`.
- MQTT JSON keys camelCase (`pwmRatio`, `chargeStage`, …). Hard ceilings: `HOUSE_V_CEIL`, `ALT_I_CEIL`, `ALT_T_CEIL`.

### 2026-07-22 — Levels: Marine Board + U2 VBus
- `waterlevels.yaml` on Marine Board: INA226 **0x41/0x45** tanks + **U2 @ 0x40 bus_voltage**.

### 2026-07-22 — Docs: Marine Board alts+levels; LilyGo fridge
- All docs state: **Marine Board** = alternators + levels; **LilyGo S3 AMOLED** = freezer/fridge for now.

### 2026-07-21 — AI context system bootstrap
- Added `AGENTS.md` + `.ai_context/` (INDEX, outstanding, risks, safety, data_flow, secrets, changelog, archive policy).
