# Safety & electrical control (invariants)

Non-derivable decisions and hard rules. **Do not paste the control-loop lambda here** — edit `esphome/packages/marine_alternator.yaml`.  
**3-layer limits (scale / hard / user SP):** `homeassistant/docs/ALTERNATOR_LIMITS.md` (authoritative).

## Intent

Port and starboard **Leece-Neville ~320 A** alternators + tank **levels** on **Sisu Marine Board** (**ESP32-S3-WROOM-2-N32R16V**). Field: **PWM1 MOSFET (GPIO38)**. Charging **Victron LiFePO4 12 V** (hard VBus max **14.4 V**). **Freezer/fridge remains on LilyGo S3 AMOLED** (not this board).

## Three-layer model (do not collapse)

| Layer | Meaning | Example current |
|-------|---------|-----------------|
| **Scale max** | Needle end / rated or theoretical | **320 A** rated |
| **Hard ceiling** | Clamp + start of **red** — must not exceed | **250 A** |
| **User setpoint** | Normal target + start of **orange** | **150 A** default |

Firmware clamps at **hard**, never only at scale max. User `number` max ≤ hard.

## Hard fail-safes (must remain)

Source: control interval in `packages/marine_alternator.yaml`.

| Condition | Constant | Action |
|-----------|----------|--------|
| NaN / invalid sensor **or setpoint** | — | PWM → 0, error |
| Sensor **stale** (no fresh V/I/T update within timeout) | `SENSOR_TIMEOUT_MS` / `TEMP_TIMEOUT_MS` | PWM → 0, error (frozen last-value no longer treated as valid) |
| Current **> 250 A** (checked on both the smoothed value and `alt_i_fast` — issue #15, post-median/pre-moving-average, ~1 tick trip vs ~1.25 s moving-average settling) | `ALT_I_CEIL` | PWM → 0 |
| Current **< -5 A** (sanity: reverse current) | — | PWM → 0 |
| Temp **> 125 °C** | `ALT_T_CEIL` | PWM → 0 |
| House V **> 14.4 V** | `HOUSE_V_CEIL` | PWM → 0 (Victron LiFePO4 max) |
| RPM ≤ `rpm_gate_sp` while enabled (belt off / stalled) | — | PWM → 0, warning (test mode bypasses) |
| Approaching temp ceiling (Tsp−5 °C .. 125 °C) | `TEMP_DERATE_START_OFFSET` | Continuous linear current-ceiling derate to 0 A at hard ceiling (not a step) |

Cascaded control, not one loop: outer voltage PI (absorption/float target → requested current) feeds an inner current PI (requested current → field PWM), each with conditional-integration + back-calculation anti-windup and field slew-rate limiting. Full logic: `packages/marine_alternator.yaml`.

**Hard faults latch** (sensor stale/invalid, current/temp/voltage hard ceiling — issue #14): field stays at 0 even after the triggering condition clears on its own. Clears only on an ENBL false→true cycle or the `clear_fault_btn` HA button. Trip count + last fault reason exposed via `fault_trip_count_sensor` (diagnostic) and `fault_latched_sensor` (binary, device_class problem). The RPM-gate interlock (#13) is a separate, non-latching **warning** — it self-clears once RPM returns, by design (transient at engine start, not a fault).

**Do not remove or raise hard cutoffs without explicit human approval and a vessel electrical review.**

## Soft defaults (HA-adjustable numbers)

| ESPHome id | HA name | Default | Max (hard) |
|------------|---------|---------|------------|
| `alt_i_sp` | Alternator Current Setpoint | **150 A** | **250 A** |
| `alt_t_sp` | Alternator Temperature Setpoint | **95 °C** | **125 °C** |
| `house_v_float` | House Float Voltage | **13.5 V** | **14.4 V** |
| `house_v_abs` | House Absorption Voltage | **14.3 V** | **14.4 V** |
| `house_v_charged` | House Charged Voltage (mirrors BMS NG) | **14.3 V** | **14.4 V** |
| `bms_bank_ah` | BMS Bank Capacity (mirrors BMS NG) | **1500 Ah** | 3000 Ah |
| `bms_tail_i_pct` | BMS Tail Current (mirrors BMS NG) | **5.0 %** | 20 % |
| `bms_charged_detect_s` | BMS Charged Detection Time (mirrors BMS NG) | **180 s** | 900 s |
| `abs_max_min` | Absorption Max Time (backstop, not a BMS mirror) | **120 min** | 240 min |
| `rpm_gate_sp` | Alternator RPM Gate (issue #13) | **0 pulses/min** | 500 |
| `house_v` | House Voltage | live U2 VBus | — |

Gauge **scale** (display only): current **320 A**, house V **14.7 V** (min **10 V**), temp **150 °C**.  
House V low policy (not on stock needle alone): orange ≤**12.0 V**, red ≤**11.0 V**.

**BMS NG mirror setpoints are operator-configured, not firmware constants** — they must be set in HA to match the real Victron BMS NG's own Charged Voltage / Tail Current / Detection Time. The alternator shunt is only a proxy for the BMS's own battery-current measurement; the controller does not emulate BMS SoC sync, it only uses matching thresholds to decide its own absorption→float transition.

Charge stage text `alt_stage`: `bulk` \| `absorption` \| `float` \| `off` (renamed from `charged` — stage 3 now actively regulates float voltage rather than terminating).  
Field: **GPIO38** → `alt_field_out`. Naming: `.ai_context/naming.md`.

## Architecture invariants

1. **One logic base, two sides**: `alternatorport.yaml` / `alternatorstarboard.yaml` only set substitutions + packages (`marine_board_base` + `marine_alternator`).
2. **Hardware**: Sisu **Marine Board** (ESP32-S3-WROOM-2-N32R16V). Field PWM **GPIO38 / PWM1** drives **onboard MOSFET** (~4 kHz); house-bank **VBus + shunt** via **INA226 U2 @ 0x40** (I²C GPIO40/41); temp DS18B20 **GPIO15**; ENBL **GPIO8**; LED **GPIO1**; buzzer **GPIO2**. See `MarineBoard/Technical Specs.md`.
3. **House-bank VBus on every Marine Board node** (U2 @ 0x40): alts *and* levels publish local voltage so HA can compare Port / Starboard / Saloon.
4. **Alternator has no internal rectifier** (fixed hardware fact — do not re-ask): bare 3-phase machine, only phase/field/ground brought out, 12 V terminal unconnected; rectification is an external 1000 A-peak bridge wired to the phase leads. No OEM low-level tach/"R" terminal exists — any RPM tap is a raw, high-current-capable winding lead. Full detail + protection guidance: `INSTALLATION.md` §6.2/§6.3.7.
5. **Test mode**: when enabled, current is simulated and ENBL is bypassed — must be `"false"` for production wrappers.
6. **Integration path**: devices expose HA API sensors/numbers; HA automation republishes JSON to MQTT for Signal K (see `data_flow.md`). Lab dual-alt sim: `bench_alts_sim.yaml` @ `.49` + `packages/sim_production_aliases.yaml`.
7. **HA is not in the safety-critical control loop.** No HA automation is currently safety-critical. Alternator field control, hard cutoffs (250 A / 14.4 V / 125 °C), the fault latch (#14), and every other safety-relevant function run **entirely locally on their own ESP32 firmware**, independent of HA's uptime — a HA Green restart does not and must not affect them. Treat a HAOS/Core restart as a normal, low-risk operational action (see `CLAUDE.md` §4 "HA Green deploy") — it briefly interrupts dashboards/history/automations, not vessel safety. If a future change ever makes an HA automation genuinely safety-critical (e.g. an HA-side interlock with no local ESP32 equivalent), this invariant must be revisited and the restart caution reinstated for that specific path.
8. **Derate before hard trip**: continuous thermal current-ceiling reduction (not a step) tries to avoid the field ever needing the absolute cutoffs; hard cutoffs still apply regardless.
9. **CAN / NMEA 2000**: GPIO43/44 reserved; gateway firmware is future work — do not put unvalidated traffic on Raymarine backbone.
10. **Spectra watermaker**: WebSocket bridge only (`python_scripts/spectra_ws.py`); START/STOP/autorun control real machine — treat as machinery, not a toy UI.

## What is NOT specified here

- Exact GPIO maps, INA226 cal factors → **source YAML** / MarineBoard  
- PID gains → **source**  
- Full entity ID list → grep YAML / HA  

## Related

- Limits policy: `homeassistant/docs/ALTERNATOR_LIMITS.md`  
- Cascade risks: `risks.md` (R1, R2, R12, R19)  
- MQTT/SK units: `data_flow.md`  
