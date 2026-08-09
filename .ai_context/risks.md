# Risks & gotchas (open only)

**Maintenance:** Delete rows when fixed or no longer applicable. No fixed-item history here.

| ID | Risk / gotcha | Cascade if wrong | Source of truth |
|----|---------------|------------------|-----------------|
| R1 | **Hard electrical cutoffs** weakened or raised without review | Battery/alternator damage, fire | `packages/marine_alternator.yaml` (`ALT_I_CEIL=250`, `ALT_T_CEIL=125`, `HOUSE_V_CEIL=14.4`); `docs/ALTERNATOR_LIMITS.md` |
| R1b | Confusing **scale max** with **hard ceiling** on gauges | Operator thinks 320 A is safe continuous; overloads | Limits doc: scale 320 / hard 250; red starts at hard |
| R2 | **`test_mode_enabled: "true"`** left on a side wrapper | Fake current drives real field PWM | `alternatorport.yaml` / `alternatorstarboard.yaml` |
| R3 | Entity rename without updating HA automation | SK metrics go stale / zero | `automations.yaml` entity_id list + payload |
| R4 | MQTT topic or JSON key change without SK map | Wrong or missing Signal K paths | `automations.yaml` + `signalk-mqtt-sensors.json` |
| R5 | **Temperature units**: HA °C → MQTT/SK **Kelvin** | Off-by-273 displays/alarms | `automations.yaml` `+ 273.15` |
| R6 | Production alts not adopted; automations point at `alternatorport_*` | SK path dead until real boards + entity match | Open issues (entity adopt / boards online); lab uses `lab_bench_alts_sim_*` + aliases |
| R7 | Secrets in git / plaintext device keys | Compromise of OTA/API/WiFi | `secrets.md`; `./scripts/scan_secrets.sh`; never commit `secrets.yaml` |
| R8 | Mosquitto `allow_anonymous true` | Unauthenticated LAN MQTT | `mosquitto/config/mosquitto.conf` |
| R10 | Edit **wrong Signal K tree** (`signalk/` vs `homeassistant/signalk/`) | Config appears “lost” after deploy | compose → `homeassistant/signalk` |
| R11 | Dual control path (device MQTT + HA publish) if both enabled | Conflicting SK updates | Prefer HA automation only |
| R12 | Shunt/voltage calibration (INA226 400 A/75 mV) | Wrong current/voltage → bad PID / false trips | `packages/marine_alternator.yaml` |
| R13 | Freezer on **LilyGo S3 AMOLED** (not Marine Board) | Wrong pin maps | `freezer.yaml` only |
| R13b | Marine Board without 12 V / U2 sense | No House Bank Voltage at that node | Board needs 12 V (or USB-C) |
| R14 | Live vessel electrics | Always bench-test before OTA on engines | README safety |
| R15 | Engine-room WiFi weak | Lost setpoints / OTA fail; PID local if ENBL wired | `NETWORK.md` |
| R16 | Unvalidated J1939/N2K gateway on shared backbone | Bus storms / Raymarine faults | Keep Yacht Devices until proven offline |
| R17 | Field is onboard MOSFET (PWM1/GPIO38), not MDDS60 | Wrong field wiring | CN2 PWM1; 4 kHz |
| R18 | Absorption &lt; Float misconfigured | Wrong stage / no taper | Firmware clamps `absorption_v >= float_v`; defaults float 13.5 / absorption 14.3 |
| R19 | VBus above Victron max | BMS / battery stress | Hard **14.4 V**; absorption capped at 14.4 |
| R20 | Large VBus delta between nodes | Corrosion / bad joint | Compare house V Port / Stbd / Saloon |
| R21 | Sisu-IoT isolation / no LAN route | HA cannot see ESPs | GL-BE9300 allow `.20→10.0/24` |
| R22 | Signal K / MQTT only on Wi‑Fi host | Dropouts | Run on **F8 192.168.0.21** |
| R23 | Helm gauges depend on Wi‑Fi/HA | Blank if IoT down | Veratron/N2K independent |
| R24 | HA on 192.168.10.x | Phone must leave Sisu SSID | Keep HA **192.168.0.20** |
| R25 | **Spectra autorun/start/stop** from HA | Real watermaker runs; FWF after cycles; FWF divert | `spectra_ws.py`, `packages/spectra_newport.yaml`; sea strainer/valves first |
| R26 | Missing MQTT integration on HA | `mqtt.publish` fails; SK never updates | Install MQTT → F8 `.21` (open F8 stack issue) |
| R27 | Dual Overview: core Home vs vessel Sisu board | Operator lands on Welcome Favorites not ship status | **Mitigated:** default = **Sisu**; Welcome hidden — re-check after HA upgrades |
| R28 | Lab sim entity max not reflash’d | HA numbers allow 250 A but device rejects / old 110 °C max | Reflash `bench_alts_sim.yaml` (open lab reflash issue) |
| R29 | `config-template-card` resource missing | Alternator gauges break (custom card) | `/local/community/config-template-card/`; `resource_mode: yaml` |
| R30 | BMS charge disconnect without field de-excite | Load dump if ATC opens while field high | Wire ATC/charge-allow into ENBL; `INSTALLATION.md` §6; ENBL helper issue |
| R31 | Dual alts no shared current budget | Combined I exceeds cable/BMS comfort | Install conservative SPs; dual-alt budget issue |
| R32 | BMS NG mirror setpoints (`house_v_charged`/`bms_bank_ah`/`bms_tail_i_pct`/`bms_charged_detect_s`) drift from the real Victron BMS NG config | Alternator's internal absorption→float proxy fires at the wrong point (early: BMS never sees its own charged condition; late: LFP held at absorption longer than needed) | Keep these 4 HA numbers matched to the physical BMS NG settings; `docs/ALTERNATOR_LIMITS.md` §BMS mirror setpoints |

## When adding a risk

One row: symptom → cascade → **path**. No long narrative. Delete when mitigated in source + no longer true.
