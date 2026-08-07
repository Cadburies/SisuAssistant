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
| NaN / invalid sensors or setpoints | — | PWM → 0, error |
| Current **> 250 A** | `ALT_I_CEIL` | PWM → 0 |
| Temp **> 125 °C** | `ALT_T_CEIL` | PWM → 0 |
| House V **> 14.4 V** | `HOUSE_V_CEIL` | PWM → 0 (Victron LiFePO4 max) |
| Temp hysteresis active | Gradual PWM reduce; PID integral reset | Band ±2.0 °C around temp setpoint |
| Voltage hysteresis active | Gradual PWM reduce; PID integral reset | Band ±0.2 V around voltage setpoint |

**Do not remove or raise hard cutoffs without explicit human approval and a vessel electrical review.**

## Soft defaults (HA-adjustable numbers)

| ESPHome id | HA name | Default | Max (hard) |
|------------|---------|---------|------------|
| `alt_i_sp` | Alternator Current Setpoint | **150 A** | **250 A** |
| `alt_t_sp` | Alternator Temperature Setpoint | **95 °C** | **125 °C** |
| `house_v_float` | House Float Voltage | **14.1 V** | **14.4 V** |
| `house_v_abs` | House Absorption Voltage | **14.3 V** | **14.4 V** |
| `house_v` | House Voltage | live U2 VBus | — |

Gauge **scale** (display only): current **320 A**, house V **14.7 V** (min **10 V**), temp **150 °C**.  
House V low policy (not on stock needle alone): orange ≤**12.0 V**, red ≤**11.0 V**.

Charge stage text `alt_stage`: `bulk` \| `absorption` \| `charged` \| `off`.  
Field: **GPIO38** → `alt_field_out`. Naming: `.ai_context/naming.md`.

## Architecture invariants

1. **One logic base, two sides**: `alternatorport.yaml` / `alternatorstarboard.yaml` only set substitutions + packages (`marine_board_base` + `marine_alternator`).
2. **Hardware**: Sisu **Marine Board** (ESP32-S3-WROOM-2-N32R16V). Field PWM **GPIO38 / PWM1** drives **onboard MOSFET** (~4 kHz); house-bank **VBus + shunt** via **INA226 U2 @ 0x40** (I²C GPIO40/41); temp DS18B20 **GPIO15**; ENBL **GPIO8**; LED **GPIO1**; buzzer **GPIO2**. See `MarineBoardSpecs/Technical Specs.md`.
3. **House-bank VBus on every Marine Board node** (U2 @ 0x40): alts *and* levels publish local voltage so HA can compare Port / Starboard / Saloon.
4. **Test mode**: when enabled, current is simulated and ENBL is bypassed — must be `"false"` for production wrappers.
5. **Integration path**: devices expose HA API sensors/numbers; HA automation republishes JSON to MQTT for Signal K (see `data_flow.md`). Lab dual-alt sim: `bench_alts_sim.yaml` @ `.49` + `packages/sim_production_aliases.yaml`.
6. **Hysteresis before hard trip**: soft limiting tries to reduce field before absolute cutoffs; hard cutoffs still apply.
7. **CAN / NMEA 2000**: GPIO43/44 reserved; gateway firmware is future work — do not put unvalidated traffic on Raymarine backbone.
8. **Spectra watermaker**: WebSocket bridge only (`python_scripts/spectra_ws.py`); START/STOP/autorun control real machine — treat as machinery, not a toy UI.

## What is NOT specified here

- Exact GPIO maps, INA226 cal factors → **source YAML** / MarineBoardSpecs  
- PID gains → **source**  
- Full entity ID list → grep YAML / HA  

## Related

- Limits policy: `homeassistant/docs/ALTERNATOR_LIMITS.md`  
- Cascade risks: `risks.md` (R1, R2, R12, R19)  
- MQTT/SK units: `data_flow.md`  
