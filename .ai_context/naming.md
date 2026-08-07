# Sisu naming convention (ESPHome · Home Assistant · Signal K · NMEA 2000)

**Goal:** One semantic model across firmware, HA UI, MQTT, Signal K, and (later) CAN/N2K.  
**Principle:** Name the **thing measured**, then **where**, then **role** — not the chip or the YAML file.

---

## 1. Layers (always the same idea, different spelling)

| Layer | Style | Example (house bank voltage at engine port) |
|-------|--------|-----------------------------------------------|
| **Semantic key** | `domain.device.instance.quantity[.role]` | `electrical.batteries.house.voltage.enginePort` |
| **ESPHome `id:`** | `snake_case`, ≤32 chars preferred | `house_v_engine_port` or `house_v_port` |
| **ESPHome / HA `name:`** | Title Case, human | `House Voltage · Engine Port` |
| **HA entity_id** | auto from device + name | `sensor.alternatorport_house_voltage_engine_port` |
| **MQTT topic (Sisu)** | `sisu/<domain>/<device>/<instance>/<quantity>[/<role>]` | `sisu/electrical/batteries/house/voltage/enginePort` |
| **Signal K path** | SK schema + instance | `electrical.batteries.house.voltage` + **source** = `enginePort` *or* extended path below |
| **NMEA 2000** | PGN + Instance field | PGN **127508** Battery Status, Instance **0** = house |

Do **not** put `ina226`, `gpio40`, `u2`, or `esphome` in user-facing names.

---

## 2. Domain vocabulary (fixed set)

| Domain | Use for |
|--------|---------|
| `electrical` | Voltage, current, power, SOC, charge stage, field PWM |
| `tanks` | Fresh/grey/black levels, loop mA |
| `propulsion` | Engine RPM, oil, coolant (Yanmar later) |
| `environment` | Air, seawater, cabin temps (when added) |
| `climate` | Fridge/freezer setpoints & measured (LilyGo) |
| `system` | WiFi RSSI, node health, enable inputs |

---

## 3. Device / bank / instance IDs (fixed set)

### 3.1 Electrical banks & machines

| Logical id | Meaning | SK instance | N2K battery/DC instance* |
|------------|---------|-------------|---------------------------|
| `house` | House LiFePO4 bank (Victron) | `batteries.house` | **0** (convention: house) |
| `start` | Start bank (if ever separate) | `batteries.start` | **1** |
| `altPort` | Port alternator | `alternators.port` | DC source / custom |
| `altStbd` | Starboard alternator | `alternators.starboard` | DC source / custom |
| `enginePort` | Port engine (Yanmar) | `propulsion.port` | Engine instance **0** |
| `engineStbd` | Starboard engine | `propulsion.starboard` | Engine instance **1** |

\*Confirm N2K instance map with Raymarine/Yacht Devices install; document any change here.

### 3.2 Measurement **location** (for same bank, many sense points)

House voltage is one bank, many places. That is **not** a second battery.

| Location id | ESPHome suffix | HA phrase | When |
|-------------|----------------|-----------|------|
| `port` | `_port` | Engine Port | Marine Board in port ER |
| `stbd` | `_stbd` | Engine Starboard | Marine Board in stbd ER |
| `saloon` | `_saloon` | Saloon | Levels / house node |
| `aft` | `_aft` | Aft | Future |
| `panel` | `_panel` | DC Panel | Future |

**Signal K pattern for multi-point house voltage (recommended):**

```
electrical.batteries.house.voltage          ← “best” or primary (e.g. saloon or BMS)
electrical.batteries.house.voltage.port     ← sense at port node
electrical.batteries.house.voltage.starboard
electrical.batteries.house.voltage.saloon
```

If a SK consumer rejects nested extensions, use **multiple values** on  
`electrical.batteries.house.voltage` with `$source` = `sisu.marineBoard.port` etc.  
Prefer **explicit path suffixes** for Sisu MQTT bridge clarity.

NMEA 2000 has **one** voltage per battery instance in 127508 — map **primary** house voltage only to N2K; keep per-location voltages in SK/HA.

---

## 4. Quantities (fixed tokens)

| Quantity | ESPHome id fragment | HA word | SK key | Unit (SK/N2K) |
|----------|---------------------|---------|--------|----------------|
| Voltage | `v` | Voltage | `voltage` | V |
| Current | `i` | Current | `current` | A |
| Power | `p` | Power | `power` | W |
| Temperature | `t` | Temperature | `temperature` | K in SK/N2K; °C in HA/ESP |
| Level (fraction) | `level` | Level | `currentLevel` | 0–1 in SK; % in HA |
| RPM | `rpm` | RPM | `revolutions` | Hz in SK (rpm/60) |
| PWM / field | `field` | Field duty | (custom) `pwmRatio` | 0–1 or % |
| Charge stage | `stage` | Charge stage | custom enum | string |

---

## 5. Roles / qualifiers (setpoints & limits)

Order in a name: **quantity + role**, not role + random words.

| Role | Meaning | ESPHome id | HA name fragment | SK / notes |
|------|---------|------------|------------------|------------|
| *(none)* | Live measured value | `house_v_port` | House Voltage · Engine Port | `.voltage.port` |
| `sp` | Operator setpoint (current target, climate target) | `alt_i_sp_port` | Alternator Current Setpoint · Port | meta or `.target` |
| `float` | Victron **Float** threshold (below → bulk amps) | `house_v_float` | House Float Voltage | charge config (not live) |
| `abs` | Victron **Absorption** (charged target) | `house_v_abs` | House Absorption Voltage | charge config |
| `ceil` | Hard ceiling (firmware constant 14.4 V) | `house_v_ceil` | House Voltage Ceiling | config / constant |
| `min` / `max` | Soft UI or alarm bounds | `house_v_min` | House Voltage Min | alarm config |
| `warn` | Warning band active | — | — | binary / text |
| `raw` | Loop mA, shunt mV (diagnostic) | `tank_aft_i_raw` | AFT Tank Loop · mA | diagnostic |

**Victron charge mapping (house bank):**

| Concept | ESPHome id | HA display | Notes |
|---------|------------|------------|--------|
| Float threshold | `house_v_float` | House Float Voltage | Default 14.1 V |
| Absorption target | `house_v_abs` | House Absorption Voltage | Default 14.3 V |
| Hard max (Victron) | `HOUSE_V_CEIL` / `VBUS_HARD_CEILING` | House Voltage Ceiling (14.4 V) | Firmware constant |
| Live sense | `house_v_<loc>` | House Voltage · \<Location\> | U2 VBus at node |

Do **not** use “bulk voltage” as a separate Victron term — **bulk** is a *stage* (full current while V &lt; float), not a voltage name.

**Charge stage enum (all layers):**

| Value | Meaning |
|-------|---------|
| `off` | Disabled / ENBL off |
| `bulk` | Full current setpoint |
| `absorption` | Tapering current |
| `charged` | At/holding absorption, tail → 0 |

ESPHome text: those strings. HA: same. SK: `electrical.batteries.house.chargingMode` or custom `electrical.alternators.port.chargingMode` if stage is per-alternator (Sisu today: **per alternator controller**).

---

## 6. Temperature classes

| Class id | HA label | SK path pattern | N2K |
|----------|----------|-----------------|-----|
| `alt` | Alternator | `electrical.alternators.<side>.temperature` | Engine/alt related or proprietary |
| `bat` / `house` | Battery / House | `electrical.batteries.house.temperature` | 127508 temp field |
| `eng` | Engine | `propulsion.<side>.temperature` | 127489 |
| `coolant` | Coolant | `propulsion.<side>.coolantTemperature` | 127489 |
| `water` | Fresh water / tank | `tanks.freshWater.<id>.temperature` if any | — |
| `air` / `cabin` | Air / Cabin | `environment.inside.temperature` | 130312 |
| `freezer` | Freezer | `climate` / custom | — |

ESPHome: `alt_t_port`, `house_t`, `freezer_t`, `eng_t_port`.  
HA: `Alternator Temperature · Port`, `House Temperature`, `Freezer Temperature`.

---

## 7. Tanks

| Logical id | HA | SK | N2K fluid instance |
|------------|-----|-----|---------------------|
| `freshAft` | Fresh Water · Aft | `tanks.freshWater.aft.currentLevel` | map per install |
| `freshFwd` | Fresh Water · Fwd | `tanks.freshWater.fwd.currentLevel` | |
| `grey` | Grey Water | `tanks.wasteWater…` | |
| `fuel` | Fuel | `tanks.fuel…` | |

- Level in HA: **%** (0–100).  
- Level in SK: **ratio** 0–1 (`currentLevel`).  
- Loop diagnostic: `fresh_aft_loop_ma` / `Fresh Water Aft · Loop mA`.

---

## 8. ESPHome YAML rules

### 8.1 Device identity

```yaml
# Marine Board node roles
# alternatorport / alternatorstarboard / waterlevels (saloon)
esphome:
  name: sisu_alt_port          # DNS-safe, short, role-based
  friendly_name: "Sisu Alt Port"
```

Suggested device names:

| Node | `esphome.name` | `friendly_name` |
|------|----------------|-----------------|
| Port alt | `sisu_alt_port` | Sisu Alt Port |
| Stbd alt | `sisu_alt_stbd` | Sisu Alt Starboard |
| Levels | `sisu_levels` | Sisu Levels |
| Freezer (LilyGo) | `sisu_freezer` | Sisu Freezer |

*(Renaming devices breaks entity_ids — migrate carefully or keep current `alternatorport` and only fix **sensor** names.)*

### 8.2 Sensor `id:` pattern

```text
{device}_{quantity}[_{role}][_{location}]

house_v_port
house_v_float          # shared config on that controller
house_v_abs
alt_i_port
alt_i_sp_port
alt_t_port
alt_t_sp_port
alt_field_port         # PWM 0–1 or %
alt_stage_port         # text bulk|absorption|charged|off
fresh_aft_level
fresh_fwd_level
enbl_port
rpm_port
```

### 8.3 Sensor `name:` pattern (HA display)

```text
{Title quantity} · {Location or side}
{Title quantity} Setpoint · {Side}
{Title} Float Voltage          # config, no location if global to house
{Title} Absorption Voltage
```

Examples:

| id | name (HA) |
|----|-----------|
| `house_v_port` | `House Voltage · Engine Port` |
| `house_v_stbd` | `House Voltage · Engine Starboard` |
| `house_v_saloon` | `House Voltage · Saloon` |
| `house_v_float` | `House Float Voltage` |
| `house_v_abs` | `House Absorption Voltage` |
| `alt_i_port` | `Alternator Current · Port` |
| `alt_i_sp_port` | `Alternator Current Setpoint · Port` |
| `alt_t_port` | `Alternator Temperature · Port` |
| `alt_stage_port` | `Alternator Charge Stage · Port` |
| `fresh_aft_level` | `Fresh Water · Aft` |
| `fresh_fwd_level` | `Fresh Water · Fwd` |

Use middle dot `·` or em dash `—` consistently (pick **·**).

### 8.4 Hard limits in firmware

```cpp
// Hard ceilings only (not gauge scale max) — docs/ALTERNATOR_LIMITS.md
constexpr float HOUSE_V_CEIL = 14.4f;   // Victron max — same as VBUS_HARD_CEILING
constexpr float ALT_I_CEIL = 250.0f;    // scale display 320 A rated
constexpr float ALT_T_CEIL = 125.0f;    // scale display 150 °C
```

Prefer names that match the semantic model (`HOUSE_V_CEIL` not only `VBUS_HARD_CEILING`). Can alias both.

---

## 9. Home Assistant

| Rule | Practice |
|------|----------|
| Display | Use ESPHome `name:` as above — do not override with cryptic HA names |
| Areas | Engine Port, Engine Starboard, Saloon, Aft Cockpit |
| Device class | `voltage`, `current`, `temperature`, `water` (level %) |
| State class | `measurement` for live; omit for setpoints |
| Entity category | `diagnostic` for RSSI, loop mA, shunt mV |
| Helpers | Name `input_number.house_v_float` only if not on device |

**Dashboard card titles:** group by bank/location, not by board chip.

---

## 10. MQTT (Sisu convention)

Bridge payload keys should match SK-ish camelCase, not ESPHome ids:

```json
{
  "voltage": 13.21,
  "current": 120.5,
  "temperature": 310.2,
  "pwmRatio": 0.42,
  "chargeStage": "bulk",
  "currentSetpoint": 150,
  "location": "port"
}
```

Topic options:

1. **SK-plugin friendly (current):** `signalk/electrical/alternators/port`  
2. **Sisu explicit:** `sisu/electrical/alternators/port/state`

Prefer keeping (1) for SK plugin and documenting key names in `data_flow.md`.

---

## 11. Signal K paths (target map)

| Sisu concept | Signal K path | Unit |
|--------------|---------------|------|
| House V at port | `electrical.batteries.house.voltage.port` | V |
| House V at stbd | `electrical.batteries.house.voltage.starboard` | V |
| House V at saloon | `electrical.batteries.house.voltage.saloon` | V |
| House current (main shunt) | `electrical.batteries.house.current` | A |
| Alt current port | `electrical.alternators.port.current` | A |
| Alt temp port | `electrical.alternators.port.temperature` | K |
| Alt field | `electrical.alternators.port.fieldDutyCycle` or `pwmRatio` | ratio |
| Fresh aft level | `tanks.freshWater.aft.currentLevel` | ratio 0–1 |
| Fresh fwd level | `tanks.freshWater.fwd.currentLevel` | ratio 0–1 |
| Engine RPM port | `propulsion.port.revolutions` | Hz |

---

## 12. NMEA 2000 / CAN (target map)

| Concept | PGN | Field | Instance |
|---------|-----|-------|----------|
| House voltage (primary) | **127508** Battery Status | Voltage | House = **0** |
| House current | **127508** | Current | 0 |
| House battery temp | **127508** | Temperature | 0 |
| Engine dynamic | **127489** | RPM, temps, … | 0=port, 1=stbd |
| Fluid level | **127505** | Level | per tank map |
| DC voltage/current detail | **127751** / **127506** | as needed | |

**Per-location house voltages** (port vs saloon sense points) stay on **HA/SK**, not separate N2K battery instances (would look like multiple banks to Raymarine).

---

## 13. Worked example: house bank voltage family

| Layer | Bulk stage threshold | Absorption target | Hard max | Live at port |
|-------|----------------------|-------------------|----------|--------------|
| Meaning | Below → full bulk amps | Charged / taper end | Victron max | Sense U2 at port board |
| ESPHome id | `house_v_float` | `house_v_abs` | `HOUSE_V_CEIL` | `house_v_port` |
| HA name | House Float Voltage | House Absorption Voltage | (constant / diagnostic) | House Voltage · Engine Port |
| SK | config only | config only | config only | `electrical.batteries.house.voltage.port` |
| N2K | — | — | clamp only | contribute to instance 0 if primary |

---

## 14. Worked example: alternator current & temperature

| Layer | Live current | Setpoint | Live temp | Temp SP | Hard I | Hard T |
|-------|--------------|----------|-----------|---------|--------|--------|
| id | `alt_i_port` | `alt_i_sp_port` | `alt_t_port` | `alt_t_sp_port` | `ALT_I_CEIL` | `ALT_T_CEIL` |
| HA | Alternator Current · Port | Alternator Current Setpoint · Port | Alternator Temperature · Port | Alternator Temp Setpoint · Port | — | — |
| SK | `electrical.alternators.port.current` | meta/custom | `…temperature` (K) | custom | — | — |

---

## 15. Implementation status (2026-07)

### Packages

```text
packages/marine_board_base.yaml   # wifi, i2c, LED, buzzer, wifi_signal
packages/marine_alternator.yaml   # PID, ENBL, field, charge, setpoints
alternatorport.yaml / starboard   # substitutions + packages
waterlevels.yaml                  # base package + tank sensors
```

### IDs vs display names (Port / Starboard side-by-side)

| Layer | Port vs Starboard |
|-------|-------------------|
| **ESPHome `id:`** | **Same** on each device (`alt_i`, `house_v`, `alt_i_sp`) — no side prefix |
| **HA device** | `Alternator Port` vs `Alternator Starboard` |
| **HA `name:`** | **Includes side** — e.g. `Alternator Current · Port` |
| **HA entity_id** | Distinct — e.g. `…_alternator_current_port` vs `…_starboard` |
| **Signal K / KIP** | Paths — `electrical.alternators.port.current` vs `.starboard.current` |

**Do you need `alternator_side` in the id?** No.  
**Do you need it in the display name?** Yes (we use `side_label` / `loc_label`) so Lovelace entity pickers and history lists are unambiguous without expanding the device.

**Setpoints (adjust 150→120 A, temp limits):**  
`number.…_alternator_current_setpoint_port` / `_starboard` — independent per side, `restore_value: true`.

| id | HA name pattern | Devices |
|----|-----------------|---------|
| `house_v` | House Voltage · {loc_label} | alt + levels |
| `house_v_float` / `house_v_abs` | House Float/Absorption Voltage · {side} | alt |
| `alt_i` / `alt_i_sp` | Alternator Current [Setpoint] · {side} | alt |
| `alt_t` / `alt_t_sp` | Alternator Temperature [Setpoint] · {side} | alt |
| `alt_field` / `alt_stage` | Field Duty / Charge Stage · {side} | alt |
| `fresh_aft_level` / `fresh_fwd_level` | Fresh Water · Aft / Fwd | levels |

SK: `electrical.batteries.house.voltage.{port,starboard,saloon}`, `electrical.alternators.{port,starboard}.*`

---

## 16. Rules of thumb

1. **Bank vs location:** `house` is the bank; `port`/`stbd`/`saloon` is where you *sensed* it.  
2. **Stage vs voltage name:** bulk/absorption/charged are **stages**; float/absorption are **voltage parameters**.  
3. **SK units:** K, A, V, ratio — convert at the bridge, not in SK.  
4. **One primary house V for N2K;** all sense points for HA diagnostics.  
5. **No chip names** in `name:`; chip only in comments.  
6. **Side abbreviations:** `port` / `stbd` in ids; “Port” / “Starboard” in HA labels.  
7. **Fridge (LilyGo):** prefix `freezer_` or `climate_freezer_` — outside Marine Board house-voltage policy unless you add a sensor.

---

## 17. Adoption

- This file is the naming authority for new entities.  
- Existing YAML may lag; migrate on touch.  
- INDEX Read-Next: naming → this file.
