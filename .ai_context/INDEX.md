# INDEX — Sisu AI context

> Only file read in full every session. Keep lean. Non-derivable orientation + router only.
> Runtime contract (issue open → claim → verify → close → push): **`CLAUDE.md`** (also for Grok/Codex).

## NEXT

1. **Open backlog:** `gh issue list --state open` (skip `agent:*`; claim protocol in `CLAUDE.md`).
2. **Done this pass:** #10/#12/#14/#15/#23 closed; #22/#13 rewrite (needs bench verify); #3 repo-side clean (needs vessel OTA check). marine_alternator.yaml now: cascaded PI, BMS mirror SPs, latched hard faults + clear button, fast overcurrent path.
3. **#6** F8 hardware still not racked (blocked, not agent-doable) — interim on Mac covers it (MQTT/#20, signalk tree/#4 both closed). `OPS.md` §7 has repoint-to-F8 steps.
4. **#7** Reflash lab dual-alt sim — blocked right now: the one physical T8-S3 is running `test_rig.yaml` (kept in place per user); would need a 2nd board or a deliberate swap-back.
5. **#11** Marine Boards when PCB ready (`.41/.42/.43`) — **`INSTALLATION.md`**; then **#1** entity verify + **#2** tank cal + **#13** RPM-gate bench verify.
6. Alt firmware left, all software-only/no vessel needed: **#16** dual-alt shared budget (bigger, deferred), **#17** sea-trial diagnostics, **#18** BMS dashboard stubs. **#5** needs human on GL-BE9300 UI.

**Rule:** update NEXT before ending a session (≤6 lines). History = `git log` + closed GitHub issues only.

## Product

| Function | Hardware |
|----------|----------|
| Alternators / levels | **Sisu Marine Board** (ESP32-S3-WROOM-2-N32R16V) on **Sisu-IoT** |
| Lab dual-alt UI | **LilyGo T8-S3** `bench_alts_sim` @ **.49** |
| Freezer | **LilyGo S3 AMOLED** on **Sisu-IoT** |
| Watermaker | **Spectra Newport 400c** @ **192.168.0.25** (WS bridge) |
| HA | **HA Green** Ethernet **.20** |
| MQTT / SK / Grafana | **TerraMaster F8** Ethernet **.21** (planned) |
| Helm gauges (planned) | **Veratron OL43** N2K |

TZ `America/Tortola`. Full network: **`NETWORK.md`**.  
**Limits policy:** `homeassistant/docs/ALTERNATOR_LIMITS.md`.

## Stack

ESP (Sisu-IoT) → HA Green (API) → F8 Mosquitto → Signal K; Influx/Grafana on F8.  
Humans on **Sisu** (Wi‑Fi 7) browse HA without joining IoT SSID (router bridges).  
Spectra is LAN-side on Sisu (`.25`), not IoT ESP.

## Layout map

| Path | Role |
|------|------|
| `homeassistant/configuration.yaml` | HA entry; Lovelace dashboards + `resource_mode: yaml` |
| `homeassistant/ui-lovelace.yaml` | Vessel **Sisu** board (zones + live tiles) |
| `homeassistant/dashboards/*.yaml` | Engine, Alternators, Power, Water, Helm |
| `homeassistant/automations.yaml` | MQTT republish of alternator metrics |
| `homeassistant/packages/spectra_newport.yaml` | Spectra bridge entities / autorun / auto-stop |
| `homeassistant/python_scripts/spectra_ws.py` | Spectra WebSocket client |
| `homeassistant/packages/nmea_gateways.yaml` | NMEA sensors — YDWG primary / DataHub failover |
| `homeassistant/python_scripts/nmea_gateways.py` | TCP health + NMEA 0183 parse |
| `homeassistant/signalk/settings.json` | SK providers incl. YDWG + DataHub TCP |
| `homeassistant/docs/ALTERNATOR_LIMITS.md` | **3-layer** scale / hard / user SP (authoritative) |
| `homeassistant/packages/sim_production_aliases.yaml` | Lab sim → production-shaped entity_ids |
| `homeassistant/esphome/packages/marine_board_base.yaml` | Shared Marine Board package |
| `homeassistant/esphome/packages/marine_alternator.yaml` | Alternator role + hard ceilings |
| `homeassistant/esphome/alternator{port,starboard}.yaml` | Production entrypoints |
| `homeassistant/esphome/waterlevels.yaml` | Levels + house_v |
| `homeassistant/esphome/bench_alts_sim.yaml` | Lab dual Port/Stbd **plant** sim @ `.49` (scripted physics) |
| `homeassistant/esphome/test_rig.yaml` | Lab HIL **test rig** @ `.48` — real control code, injected values (#23) |
| `homeassistant/esphome/freezer.yaml` | LilyGo fridge/freezer |
| `scripts/ha-*.sh` / `scripts/scan_secrets.sh` | Agent deploy + secret scan |
| `INSTALLATION.md` | Full install manual |
| `OPS.md` / `NETWORK.md` | Ops + network |
| `CLAUDE.md` | Parallel agents, claim, verify, commit |

## Read-Next (task → open)

| Task type | Open (≤2) | Source first |
|-----------|-----------|--------------|
| Backlog / pick next work | GitHub Issues only (`gh issue list --state open`) | issue body **Touches** |
| Issue open / claim / close cycle | `CLAUDE.md` §1–§6 + §Closing cycle | — |
| Parallel agents | `CLAUDE.md` §Parallel agents | — |
| File a new issue | `CLAUDE.md` §Filing issues + `.github/ISSUE_TEMPLATE/task.md` | — |
| Alternator PID / charge / safety | `safety.md`, `risks.md` | `packages/marine_alternator.yaml` + `docs/ALTERNATOR_LIMITS.md` |
| Alternator gauges / setpoints | `safety.md` | `dashboards/alternators.yaml` |
| Levels / tanks | `safety.md` | `esphome/waterlevels.yaml` |
| Spectra / water | `data_flow.md` | `spectra_ws.py`, `packages/spectra_newport.yaml` |
| HA dashboards / Overview | `displays.md` | `configuration.yaml`, `ui-lovelace.yaml` |
| MQTT / Signal K | `data_flow.md`, `risks.md` | `automations.yaml` |
| NMEA / YDWG / DataHub | `data_flow.md` | `nmea_gateways.py`, `packages/nmea_gateways.yaml` |
| Network / F8 / Grafana | — | `NETWORK.md` |
| Agent access / deploy | — | `OPS.md`, `scripts/ha-*.sh` |
| Lab T8 plant sim | `OPS.md` | `esphome/bench_alts_sim.yaml` |
| Lab T8 HIL test rig (inject real control-code inputs) | — | `esphome/test_rig.yaml`, `dashboards/test_rig.yaml` |
| Secrets / git hygiene | `secrets.md` | `secrets.yaml.example`, `scripts/scan_secrets.sh` |
| Physical install / wiring | — | **`INSTALLATION.md`** |
| Bug from backlog | matching issue + `risks.md` | paths in **Touches** |

**Never session-load:** `.ai_context/archive/*`, full long specs, `node_modules`. Open backlog = **GitHub Issues only** — never a markdown backlog under `.ai_context/`.

## Rules (≤5)

1. Session load: INDEX + ≤2 warm files + source. Never auto-load archive/changelog dumps.
2. Alternator hard cutoffs sacred (250 A / 14.4 V / 125 °C); change only with approval + update `ALTERNATOR_LIMITS.md`.
3. Entity/topic renames cascade HA → MQTT → Signal K.
4. Backlog = GitHub Issues only; claim → verify → close cycle in `CLAUDE.md`; delete resolved **risks** rows only.
5. No Tier-C mirrors. Alts+levels = Marine Board; fridge = LilyGo; Spectra = WS bridge. Never commit secrets.

## Warm files

| File | Contents |
|------|----------|
| `risks.md` | Open cascade/gotchas only |
| `safety.md` | Electrical invariants + 3-layer limits pointer |
| `data_flow.md` | HA↔MQTT↔SK + Spectra |
| `displays.md` | Tablet paths, dual Overview |
| `secrets.md` | Secret policy (no live values) |
| `naming.md` | ESPHome / HA / SK / N2K naming |
| `changelog.md` | Optional short hot notes (do not auto-load; prefer issue threads) |

Repo runtime contract (issue lifecycle): **`CLAUDE.md`**. Compact hard rules: **`AGENTS.md`**.
