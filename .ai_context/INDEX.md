# INDEX — Sisu AI context

> Only file read in full every session. Keep lean. Non-derivable orientation + router only.
> Runtime contract (issue open → claim → verify → close → push): **`CLAUDE.md`** (also for Grok/Codex).

## NEXT

1. **Open backlog:** `gh issue list --state open` (skip `agent:*`; claim protocol in `CLAUDE.md`).
2. **Done this pass:** **#45** ingest, **#50** chips, **#46** one `sensor.nmea_*`, **#47** Influx `Sisu_raw`+`Sisu_1m`. Next: **#48** SK. **#3** freezer still open.
3. **#6** F8 hardware still not racked (blocked, not agent-doable) — **until it lands, "the F8 stack" means the Mac stack** (`docker-compose.mac.yml`), per standing convention set closing #24 (2026-08-15). `OPS.md` §7 is the day-to-day reference; #6 carries the migration checklist for when F8 actually comes online.
4. **#11** Marine Board **shipped, in transit** (not yet arrived) — when it lands: flash `.41/.42/.43` per `INSTALLATION.md`; then **#1** entity verify + **#2** tank cal.
5. Engine RPM/coolant/etc trending is wired but empty — `sensor.sisu_engine_*` is `unavailable` (Signal K engine REST bridge, #25, not currently returning data on this interim setup); will backfill once that's live again.
6. Remaining P3: **#16** dual-alt shared budget, **#17** sea-trial diagnostics, **#26** MarineBoard PCB rev2 RPM protection (in-flight elsewhere — KiCad edits landing from another session), **#19** INA226 Alert pin.

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
| `homeassistant/dashboards/*.yaml` | Engine, Alternators, Power, Water, Helm, Weather Anchor |
| `homeassistant/automations.yaml` | MQTT republish of alternator metrics |
| `homeassistant/packages/spectra_newport.yaml` | Spectra bridge entities / autorun / auto-stop |
| `homeassistant/python_scripts/spectra_ws.py` | Spectra WebSocket client |
| `homeassistant/packages/source_health.yaml` | Source chips + canonical `sensor.nmea_*` from `sisu/v1` |
| `homeassistant/python_scripts/nmea_gateways.py` | TCP health + NMEA 0183 parse |
| `homeassistant/signalk/settings.json` | SK providers incl. YDWG + DataHub TCP |
| `homeassistant/docs/ALTERNATOR_LIMITS.md` | **3-layer** scale / hard / user SP (authoritative) |
| `.ai_context/sources.md` | Quantity → source priority + kernel contract (#44) |
| `homeassistant/docs/SpectraControl.md` | Spectra pages, navigation, what each page can return |
| `homeassistant/packages/sim_production_aliases.yaml` | Lab sim → production-shaped entity_ids |
| `homeassistant/packages/trending_influxdb.yaml` | HA → InfluxDB wiring (`influxdb:` integration) |
| `homeassistant/packages/marine_environment.yaml` | Tides (NOAA) + weather/temp fallback (Open-Meteo) — issue #32 |
| `homeassistant/python_scripts/tides_noaa.py` | Nearest NOAA tide station + hilo predictions |
| `homeassistant/packages/sv3c_aft_camera.yaml`, `sv3c_forward_camera.yaml` | SV3C ONVIF cameras (issue #33) — Off/On/Sentry mode, motion → photo-burst; not ESPHome devices |
| `homeassistant/grafana-provisioning/` | Grafana datasource + dashboards (git-tracked, file-provisioned) |
| `homeassistant/influx-tasks/` | Influx Flux tasks: `sisu_raw_mirror`, `sisu_1m` (#47) |
| `homeassistant/esphome/packages/marine_board_base.yaml` | Shared Marine Board package |
| `homeassistant/esphome/packages/marine_alternator.yaml` | Alternator role + hard ceilings |
| `homeassistant/esphome/alternator{port,starboard}.yaml` | Production entrypoints |
| `homeassistant/esphome/waterlevels.yaml` | Levels + house_v |
| `homeassistant/esphome/bench_alts_sim.yaml` | Lab dual Port/Stbd **plant** sim @ `.49` (scripted physics) |
| `homeassistant/esphome/test_rig.yaml` | Lab HIL **test rig** @ `.48` — real control code, injected values (#23) |
| `scripts/esphome_web_client.py`, `scripts/test_alternator_hil.py` | Reusable HIL test client + scenario suite (#28); methodology: `esphome/docs/HIL_TEST_PROCEDURE.md` |
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
| Spectra / water | `sources.md`, `data_flow.md` | `spectra_ws.py`, `packages/spectra_newport.yaml`, **`docs/SpectraControl.md`** |
| HA dashboards / Overview | `displays.md` | `configuration.yaml`, `ui-lovelace.yaml` |
| MQTT / Signal K | `data_flow.md`, `risks.md` | `automations.yaml` |
| NMEA / YDWG / DataHub | `sources.md`, `data_flow.md` | `nmea_gateways.py`, `packages/source_health.yaml` |
| New quantity / source / ingest | `sources.md` | do not invent `_live` twins |
| Network / F8 / Grafana | — | `NETWORK.md` |
| Trending / InfluxDB / Grafana dashboards | `data_flow.md` §Trending pipeline | `packages/trending_influxdb.yaml`, `grafana-provisioning/` |
| Agent access / deploy | — | `OPS.md`, `scripts/ha-*.sh` |
| Lab T8 plant sim | `OPS.md` | `esphome/bench_alts_sim.yaml` |
| Lab T8 HIL test rig (inject real control-code inputs) | — | `esphome/test_rig.yaml` (no dashboard — physical board removed 2026-08-10; HA REST via `scripts/esphome_web_client.py` when a board is present again) |
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
| `sources.md` | Quantity → source priority + kernel (#44) |
| `changelog.md` | Optional short hot notes (do not auto-load; prefer issue threads) |

Repo runtime contract (issue lifecycle): **`CLAUDE.md`**. Compact hard rules: **`AGENTS.md`**.
