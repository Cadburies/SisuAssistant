# Risks & gotchas (open only)

**Maintenance:** Delete rows when fixed or no longer applicable. No fixed-item history here.

| ID | Risk / gotcha | Cascade if wrong | Source of truth |
|----|---------------|------------------|-----------------|
| R1 | **Hard electrical cutoffs** weakened or raised without review | Battery/alternator damage, fire | `packages/marine_alternator.yaml` (`ALT_I_CEIL=250`, `ALT_T_CEIL=125`, `HOUSE_V_CEIL=14.4`); `docs/ALTERNATOR_LIMITS.md` |
| R1b | Confusing **scale max** with **hard ceiling** on gauges | Operator thinks 320 A is safe continuous; overloads | Limits doc: scale 320 / hard 250; red starts at hard |
| R2 | **Shadow OFF** (or field wire landed) before I/V/T match the existing regulator | Wrong cal drives real field; or two regulators if eMax still connected | `shadow_sw` default ON; `INSTALLATION.md` §6.4 |
| R3 | Entity rename without updating HA automation | SK metrics go stale / zero | `automations.yaml` entity_id list + payload |
| R4 | MQTT topic or JSON key change without SK map | Wrong or missing Signal K paths | `automations.yaml` + `signalk-mqtt-sensors.json` |
| R5 | **Temperature units**: HA °C → MQTT/SK **Kelvin** | Off-by-273 displays/alarms | `automations.yaml` `+ 273.15` |
| R6 | Production alts not adopted; automations point at `alternatorport_*` | SK path dead until real boards + entity match | #11 |
| R7 | Secrets in git / plaintext device keys | Compromise of OTA/API/WiFi | `secrets.md`; `./scripts/scan_secrets.sh`; never commit `secrets.yaml` |
| R8 | Mosquitto `allow_anonymous true` | Unauthenticated LAN MQTT | `mosquitto/config/mosquitto.conf` |
| R10 | Edit **wrong Signal K tree** (`signalk/` vs `homeassistant/signalk/`) | Config appears “lost” after deploy | compose → `homeassistant/signalk` |
| R11 | Dual control path (device MQTT + HA publish) if both enabled | Conflicting SK updates | Prefer HA automation only |
| R12 | Shunt/voltage calibration (INA226 400 A/75 mV) | Wrong current/voltage → bad PID / false trips | `packages/marine_alternator.yaml` |
| R13 | Two freezer builds (`freezer.yaml` LilyGo, `freezer_marineboard.yaml` Marine Board) share name/IP/API key | Both online = HA flapping; wrong YAML = wrong pin map | Flash only the one matching the fitted hardware |
| R13b | Marine Board without 12 V / U2 sense | No House Bank Voltage at that node | Board needs 12 V (or USB-C) |
| R14 | Live vessel electrics | Always bench-test before OTA on engines | README safety |
| R15 | Engine-room WiFi weak | Lost setpoints / OTA fail; PID local if ENBL wired | `NETWORK.md` |
| R16 | Unvalidated J1939/N2K gateway on shared backbone | Bus storms / Raymarine faults | Keep Yacht Devices until proven offline |
| R17 | Field is onboard MOSFET (PWM1/GPIO38), not MDDS60 | Wrong field wiring | CN2 PWM; 4 kHz |
| R18 | Absorption &lt; Float misconfigured | Wrong stage / no taper | Firmware clamps `absorption_v >= float_v`; defaults float 13.5 / absorption 14.3 |
| R19 | VBus above Victron max | BMS / battery stress | Hard **14.4 V**; absorption capped at 14.4 |
| R20 | Large VBus delta between nodes | Corrosion / bad joint | Compare house V Port / Stbd / Saloon |
| R22 | Signal K / MQTT only on Wi‑Fi host | Dropouts | Run on **F8 192.168.0.21** |
| R23 | Helm gauges depend on Wi‑Fi/HA | Blank if IoT down | Veratron/N2K independent |
| R24 | HA on 192.168.10.x | Phone must leave Sisu SSID | Keep HA **192.168.0.20** |
| R25 | **Spectra autorun/start/stop** from HA | Real watermaker runs; FWF after cycles; FWF divert | `spectra_ws.py`, `packages/spectra_newport.yaml`; sea strainer/valves first |
| R27 | Dual Overview: core Home vs vessel Sisu board | Operator lands on Welcome Favorites not ship status | **Mitigated:** default = **Sisu**; Welcome hidden — re-check after HA upgrades |
| R29 | `config-template-card` resource missing | Alternator gauges break (custom card) | `/local/community/config-template-card/`; `resource_mode: yaml` |
| R30 | BMS charge disconnect without field de-excite | Load dump if ATC opens while field high | Wire ATC/charge-allow into ENBL; `INSTALLATION.md` §6; ENBL helper issue |
| R32 | BMS NG mirror setpoints (`house_v_charged`/`bms_bank_ah`/`bms_tail_i_pct`/`bms_charged_detect_s`) drift from the real Victron BMS NG config | Alternator's internal absorption→float proxy fires at the wrong point (early: BMS never sees its own charged condition; late: LFP held at absorption longer than needed) | Keep these 4 HA numbers matched to the physical BMS NG settings; `docs/ALTERNATOR_LIMITS.md` §BMS mirror setpoints |
| R35 | RPM tap (issue #13) would be a **raw phase-winding lead** — alternator has no internal rectifier/no OEM tach terminal (external 1000 A-peak bridge does rectification instead); a TVS/Zener clamp alone does not limit current, and small "1500 W" axial TVS parts are only ~6.5 W steady-state (1500 W is a 10/1000 µs pulse rating, ~100-400× shorter than a real load-dump event) | Underspecced clamp cooks itself on normal operation (if standoff too low) or fails to survive a real fault (if sized off the peak-pulse number instead of steady-state); undersized/missing series resistor lets winding's low source impedance drive destructive current into clamp + opto | `INSTALLATION.md` §6.2 / §6.3.7 (full guidance); prefer tapping DC-side ripple off the external bridge instead of a raw phase lead if practical |
| R36 | HA's entity registry can silently strand a **live, newly-reconfigured** entity behind a stale duplicate holding the same human-readable entity_id — seen twice: (a) reflashing a physical ESP32 to a **different YAML file/role**, where the `esphome` integration matches by **MAC**, renames the device, but any entity whose (mac+domain+literal `name:`) is unchanged keeps its **old** entity_id forever (#29, T8-S3 `bench_alts_sim.yaml`→`test_rig.yaml`, 20 entities stuck under `lab_bench_alts_sim_*`); (b) converting a `template:` entity from plain state-templated to **trigger-based** with the *same* `unique_id:` — HA didn't recognize it as the same entity, created a fresh row, and 3 of 13 collided into `_2`-suffixed entity_ids while the stale pre-conversion entity kept squatting the clean name, frozen (`"restored": true`) forever (#31, `spectra_newport.yaml`) | Dashboards/automations referencing the expected entity_id show "entity not found"/unavailable; a config-entry remove+re-add or a Core restart does **not** fix it — HA reattaches to the same identity on MAC/unique_id match, stale duplicate and all | Check for a `_2`/`_3`-suffixed sibling and a `"restored": true`-frozen entity at the *expected* bare name whenever a device/entity is reconfigured (reflash, or state→trigger template restructure) and something that should be live still reads unavailable. Fix: remove the stale duplicate + rename the live `_N` entity into the clean slot via `config/entity_registry/remove` + `config/entity_registry/update` (`new_entity_id`) — not a device delete/re-add |

## When adding a risk

One row: symptom → cascade → **path**. No long narrative. Delete when mitigated in source + no longer true.
