# Outstanding (open only)

**Maintenance:** Delete rows when done. No strikethrough. No “completed” section.  
Only items that are **still true**: documented but unimplemented, or discovered open work.

Hardware install practice → **`INSTALLATION.md`** (not duplicated as long how-tos here).

## Product / integration

| ID | Item | Where | Notes |
|----|------|-------|-------|
| O1 | Verify production alt entity_ids after Marine Board adopt | HA + `automations.yaml` | Lab uses `lab_bench_alts_sim_*` + aliases. Re-check real `alternatorport`/`starboard` slugs after first adopt. |
| O3 | Levels tank % calibration on vessel | `esphome/waterlevels.yaml` | Marine Board + 4–20 mA; tune when hardware online. Blocks Spectra smart liters / 95% auto-stop. |
| O4 | Hardcoded secrets in freezer YAML | `esphome/freezer.yaml` | OTA password still inline; move to `!secret`. |
| O6 | Root `signalk/` vs `homeassistant/signalk/` | repo | Compose uses `homeassistant/signalk`. Root tree is sample/legacy. |
| O12 | GL-BE9300 static reservations + firewall audit | `NETWORK.md` | LAN→IoT works for lab `.49`; still confirm permanent DHCP reservations `.20/.21/.41–.44/.49` and rule durability after router reboot. |
| O14 | F8 MQTT / Signal K / Influx / Grafana stack | TNAS + compose | Production broker target `192.168.0.21`. HA MQTT not configured yet (session logs: `mqtt.publish` missing). |
| O15 | Reflash lab dual-alt sim for new hard ceilings | `esphome/bench_alts_sim.yaml` | Repo: I hard 250 / V 14.4 / T 125; number max matches. Device still needs OTA/USB reflash so setpoints accept new ranges. |
| O17 | Spectra: marine-board stop-at-95% untested | `packages/spectra_newport.yaml` | Automation present; needs live tank entities (O3). Smart liters falls back to 400 L until then. |
| O18 | Spectra: FWF divert retry robustness | `python_scripts/spectra_ws.py` | Startup can divert to FWF; cancel/retry exists; needs more on-water soak testing. |
| O19 | House V low-side bands not on needle gauge | `docs/ALTERNATOR_LIMITS.md` | Policy: orange ≤12.0 V, red ≤11.0 V. Stock HA gauge is high-side only; need helpers/card later. |
| O20 | Production Marine Boards not online | `.41–.43` | Lab T8 sim only; real alts/levels when PCB ready. |

## Software — alternator control enhancements

*(From safety review: BMS NG + PWM hardware cover pack/field fail-safe; these are firmware/HA improvements.)*

| ID | Item | Where | Notes |
|----|------|-------|-------|
| O21 | **ENBL / charge-allow integration helper** | `marine_alternator.yaml` + docs | Document + optional binary template: BMS ATC / charge-path feedback **AND** engine-run into ENBL logic (or second interlock input). Firmware already field-off when ENBL false — ensure install wires ATC into ENBL (`INSTALLATION.md` §6). Software: status text if “run but no charge allow” once a second input exists. |
| O22 | **RPM / engine-run field gate** | `marine_alternator.yaml` | RPM opto exists (GPIO4) but is unused in control. Gate field unless RPM above threshold (or oil-pressure/D+). Protects alt when belt off / stalled. |
| O23 | **Latch hard safety faults** | `marine_alternator.yaml` | Today I/V/T hard trip zeros field for that 1 s tick then can re-excite. Latch until ENBL cycle or explicit clear; expose clear in HA. |
| O24 | **Faster hard V/I path** | `marine_alternator.yaml` + INA226 | Loop is 1 Hz with averaging. Add faster raw sample path and/or wire INA226 **Alert** (currently unconnected on schematic — needs HW rework **or** poll alert if later connected) for over-V/over-I field cut in ≪1 s. |
| O25 | **Dual-alt shared house current budget** | both alts + HA or leader logic | Independent PIDs can sum to high house current. Software: shared max (e.g. 250–300 A bank) or droop/master-slave so Port+Stbd respect bank/cabling. |
| O26 | **Sea-trial / diagnostics logging helpers** | ESPHome + HA | Entities or ring buffer: field %, A, V, T, stage, hard-trip counters; optional MQTT/SK for post-run review. |
| O27 | **Pack / charge-context sensors in HA** | HA + Victron integration | Surface BMS state (charge allow, alarms) next to alt dashboards; optional automations to force current SP down if BMS warns (BMS remains authority). |
| O28 | **INA226 Alert support (when HW available)** | board + firmware | Schematic Alert pin unused. If future rev connects Alert→GPIO, implement ISR/fast path for O24. |

## Closed this session (do not re-add)

- Spectra WS bridge + autorun liters/hours + Water UI (live).  
- Lovelace legacy `mode: yaml` → `resource_mode` + `dashboards.lovelace` (HA 2026.8).  
- Alternator 3-layer limits policy + dashboard bands + firmware constants aligned in **repo**.  
- Dual-alt sim adopted in lab; LAN→IoT route working for `.49`.  
- **O16** Human: hide Welcome Overview / default dashboard = **Sisu** vessel board.  
- **INSTALLATION.md** full vessel install manual (hardware how-to + safety).

## Maintenance rules

- Prefer greppable IDs (O1…).
- Link **paths**, not pasted code.
- Hardware procedures live in **`INSTALLATION.md`**; software gaps stay here.
- After closing: delete the row; optional one-line hot changelog entry if behavior changed.
