# Sisu Marine Automation System — Technical Specifications

**Version:** 2.1  
**Date:** July 2026  
**Status:** Marine Board + HA Green + TerraMaster F8 + Wi‑Fi 7 topology  

Vessel **Sisu**: electrical management (dual alternators), tank levels, freezer control, helm N2K instruments, and marine data aggregation via Home Assistant, MQTT, and Signal K.

| Document | Authority |
|----------|-----------|
| **`NETWORK.md`** | **GL.iNet GL-BE9300** actions, SSIDs, HA Green, F8, routing, secrets, Grafana, helm |
| **`MarineBoardSpecs/Technical Specs.md`** | PCB GPIO, power, connectors |
| **`.ai_context/naming.md`** | Entity / SK / N2K naming |
| **This file** | System roles, firmware, safety, functional integration |

---

## 1. System Overview

```
Phones on SSID "Sisu" (Wi‑Fi 7)
        │  browser → HA (no need to join Sisu-IoT)
        ▼
┌──────────────────┐   Ethernet    ┌─────────────────────────┐
│ HA Green         │◄─────────────►│ TerraMaster F8 SSD Plus │
│ 192.168.0.20     │               │ 192.168.0.21            │
│ Home Assistant   │               │ Mosquitto · Signal K    │
│ ESPHome client   │               │ Grafana · InfluxDB      │
└────────┬─────────┘               └────────────┬────────────┘
         │ API → 192.168.10.0/24                │ MQTT
         ▼                                      ▼
┌──────────────────┐                    SK / KIP / trends
│ ESP32 Sisu-IoT   │
│ .41 alt port     │── N2K ──► Raymarine · Veratron OL43 (helm)
│ .42 alt stbd     │
│ .43 levels       │
│ .44 freezer      │
└──────────────────┘
```


| Function | Hardware | Firmware / notes |
|----------|----------|------------------|
| Alternator Port / Starboard | **Sisu Marine Board** (ESP32-S3-WROOM-2-N32R16V) | `alternatorport.yaml` / `alternatorstarboard.yaml` + packages |
| Fresh water levels | **Sisu Marine Board** | `waterlevels.yaml` (INA226 + house VBus) |
| Freezer / fridge | **LilyGo S3 AMOLED** (for now) | `freezer.yaml` |
| Home automation host | **Home Assistant Green** (Ethernet) | HA Core |
| MQTT + Signal K + graphs | **TerraMaster F8 SSD Plus** (Ethernet, Docker) | See `NETWORK.md` |
| Helm engine/fuel gauges | **Veratron OL43** (or class) on **NMEA 2000** | Not ESP web UI; see `NETWORK.md` §7 |

Marine Board is an **I/O + control node**. Helm glass is **N2K**. Phone UI is **HA on SSID Sisu** with router bridging to Sisu-IoT.

---

## 2. System Requirements

### 2.1 Hardware

#### Microcontrollers / boards

| Role | Platform | Notes |
|------|----------|--------|
| Alternator + levels | **Sisu Marine Board** — **ESP32-S3-WROOM-2-N32R16V** | 32 MB octal flash, 16 MB octal PSRAM; one board per engine room preferred for alts |
| Freezer / fridge | **LilyGo S3 AMOLED** | Onboard display + touch; keep current product until redesign |

#### Power and charging plant

- **Victron LiFePO4** 12 V battery bank (BMS NG)
- **Leece-Neville** 12 V ~320 A alternators (Port and Starboard)
- Field excitation driven by Marine Board **PWM1** (GPIO38 → opto → TC4427 → MOSFET) — **no MDDS60**

#### Sensors and I/O (Marine Board roles)

| Use | Path on Marine Board |
|-----|----------------------|
| House-bank VBus (every Marine Board node) + alt current | INA226 **U2 @ 0x40** VBus always; **400 A / 75 mV** shunt on alt boards (Kelvin) |
| Tank / level loops (×2) | INA226 **U18 @ 0x41**, **U19 @ 0x45**, 4–20 mA, 3.9 Ω sense, +12 V loop |
| Alternator temperature | DS18B20 on **TMP1 / GPIO15** (1-Wire) |
| Enable (field allow) | Opto **ENBL / GPIO8** |
| RPM (optional) | Opto **RPM / GPIO4** |
| Status | LED **GPIO1**, buzzer **GPIO2** |
| CAN (future N2K / engine) | SN65HVD230, **GPIO43 TX / GPIO44 RX**, 250 kbps |

#### Freezer (LilyGo S3 AMOLED)

- Quad SPI AMOLED + touch (CST816 class)
- Local climate / compressor control as in `freezer.yaml`
- HA API for setpoints and remote sensors

#### Communication backbone

Full topology: **`NETWORK.md`**.

- **Sisu-IoT** (2.4 GHz, internet OK): all ESP32s  
- **Sisu** (Wi‑Fi 7 clients): phones/laptops → browser to HA **without** joining IoT SSID (router must route Sisu ↔ LAN ↔ Sisu-IoT)  
- **Sisu_Guest**: isolated  
- HA Green + F8: **Ethernet** to Wi‑Fi 7 router  
- HA API to ESPs; MQTT on F8 → Signal K on F8  
- NMEA 2000 / SeaTalkNG: helm (Veratron), Raymarine; alts/engine gateway paths per `NETWORK.md`

### 2.2 Software

- ESPHome (firmware)
- Home Assistant
- Signal K + plugins (MQTT sensors; optional KIP)
- Mosquitto MQTT
- Docker Compose host stack (HA, ESPHome dashboard, Mosquitto, Signal K)

---

## 3. Functional Specifications

### 3.1 Alternator control (Marine Board)

- **Current regulation**: PID on alternator current (default setpoint **150 A**, range 0–250 A)
- **Victron-style charge stages** (VBus = INA226 U2 bus voltage):
  - **Bulk** — VBus **&lt; Float** (default **14.1 V**): full current setpoint
  - **Absorption** — Float ≤ VBus **&lt; Absorption** (default **14.3 V**): linear **amp taper** (BMS sees tail current)
  - **Charged** — VBus ≥ Absorption: target current → 0; hold so voltage does not climb
- **Hard VBus ceiling**: **14.4 V** (Victron LiFePO4 recommended max) — field off if exceeded
- **Temperature**: DS18B20; soft hysteresis around temp setpoint; hard trip **&gt; 125 °C**
- **Overcurrent hard trip**: **&gt; 250 A** (rated nameplate **320 A** is scale max only — not the clamp)
- **ENBL gate**: field PWM forced off when enable input is inactive (unless bench `test_mode`)
- **Status**: LED patterns + buzzer on error
- **Data**: HA entities; HA automation republishes JSON to MQTT for Signal K (port today; starboard parity planned)
- **3-layer limits (scale / hard / user SP):** `homeassistant/docs/ALTERNATOR_LIMITS.md`

### 3.2 Hard safety constants (firmware)

Named in `packages/marine_alternator.yaml` control loop — do not raise without electrical review.
**Hard ≠ scale max.** Gauge scale may show 320 A / 14.7 V / 150 °C; clamps use the table below.

| Constant | Value | Action |
|----------|-------|--------|
| `CURRENT_HARD_CEILING` / `ALT_I_CEIL` | **250 A** | PWM → 0 |
| `TEMP_HARD_CEILING` / `ALT_T_CEIL` | **125 °C** | PWM → 0 |
| `VBUS_HARD_CEILING` / `HOUSE_V_CEIL` | **14.4 V** | PWM → 0 |

Soft bands: temp hysteresis ±2 °C; voltage band around absorption; stage re-bulk hysteresis below float.

### 3.3 Control algorithm (summary)

| Item | Spec |
|------|------|
| PID (current) | Kp=0.01, Ki=0.001, Kd=0.005, anti-windup |
| Control loop | 1 Hz |
| Field PWM | LEDC **GPIO38**, ~**4 kHz** (opto bandwidth), duty 0–1 |
| LED / status loop | 50 ms |
| Sensor update | ~1–2 s (INA226, DS18B20) |

### 3.4 Tank levels (Marine Board)

- Two **4–20 mA** loops (SW-LT100 class or equivalent), +12 V loop supply
- Measurement: INA226 **U18 @ 0x41**, **U19 @ 0x45** → loop mA → tank % (4 mA = 0%, 20 mA = 100%)
- **House Bank Voltage Levels** from **U2 INA226 @ 0x40 VBus** (policy: all Marine Board firmware reports local house voltage for drop diagnostics)
- Firmware: `homeassistant/esphome/waterlevels.yaml`

### 3.5 Freezer / fridge (LilyGo S3 AMOLED)

- Local UI on AMOLED; climate / compressor GPIO as configured
- Remains on **LilyGo** for now; not required to move to Marine Board
- Integrates via HA API / sensors as today

---

## 4. Software Architecture

### 4.1 ESPHome layout

| File | Role |
|------|------|
| `esphome/packages/marine_board_base.yaml` | Shared Wi‑Fi, I²C, LED, buzzer |
| `esphome/packages/marine_alternator.yaml` | Alternator PID, charge, setpoints |
| `esphome/alternatorport.yaml` / `starboard` | Entrypoints (substitutions + packages) |
| `esphome/waterlevels.yaml` | Levels entrypoint + tank sensors |
| `esphome/freezer.yaml` | LilyGo S3 AMOLED (no Marine Board package) |
| `MarineBoardSpecs/Technical Specs.md` | PCB GPIO, power, connectors, J3 |

Alternator base uses **esp-idf**, I²C **GPIO40/41**, INA226 @ **0x40**, one-wire **GPIO15**, PWM **GPIO38**.

### 4.2 Home Assistant

- `configuration.yaml` includes automations / scripts / scenes
- `automations.yaml`: MQTT republish of alternator metrics (port entities → `signalk/electrical/alternators/port`; starboard parity outstanding)
- Secrets: `homeassistant/secrets.yaml` (ESPHome symlink)

### 4.3 Signal K

- Ingest via MQTT topics under `signalk/…` (plugin map in `homeassistant/signalk/plugin-config-data/`)
- Temperature in JSON payload: **Kelvin** (HA/device °C + 273.15 in automation)

### 4.4 Validation

- ESPHome compile / config check per device YAML
- I²C scan: expect **0x40** (battery); **0x41 / 0x45** when levels populated
- Bench: `test_mode_enabled` only; never leave true in engine room
- Live: hard cutoffs, ENBL, charge stage, WiFi RSSI diagnostic

---

## 5. Interface Specifications

### 5.1 Alternator MQTT (via HA automation)

**Topics:** `signalk/electrical/alternators/{port|starboard}`  
**Keys (camelCase):** see `.ai_context/naming.md` §10

```json
{
  "current": 0.0,
  "voltage": 0.0,
  "temperature": 0.0,
  "pwmRatio": 0.0,
  "chargeStage": "bulk",
  "currentSetpoint": 150.0,
  "temperatureSetpoint": 0.0,
  "status": "",
  "location": "port"
}
```

`temperature*` in **Kelvin** on the bus.  
House voltage SK: `electrical.batteries.house.voltage.{port|starboard|saloon}`.

### 5.2 Primary HA entities (device-scoped names)

| Type | HA name (on Alternator Port / Starboard device) | ESPHome id |
|------|--------------------------------------------------|------------|
| Sensor | House Voltage | `house_v` |
| Sensor | Alternator Current | `alt_i` |
| Sensor | Alternator Temperature | `alt_t` |
| Sensor | Alternator Field Duty | `alt_field` |
| Sensor | Alternator Charge Stage | `alt_stage` |
| Number | House Float Voltage | `house_v_float` |
| Number | House Absorption Voltage | `house_v_abs` |
| Number | Alternator Current Setpoint | `alt_i_sp` |
| Number | Alternator Temperature Setpoint | `alt_t_sp` |
| Binary | Alternator Enable | `enbl` |
| Text | Alternator Status | `alt_msg` |

Levels device: **House Voltage**, **Fresh Water · Aft**, **Fresh Water · Fwd**.

### 5.3 Marine Board field connectors (summary)

Full table: **MarineBoardSpecs** HEADER PINS / Technical Specs.

| Connector | Typical use (alts / levels) |
|-----------|------------------------------|
| CN1 | +12 V battery in |
| CN2 | PWM1 field / load + +12 V |
| U4 | Shunt sense SH± |
| U5 / U6 | Level loops LVL1 / LVL2 |
| U7 | CAN H/L/GND |
| U13 | ENBL, RPM, TMP1 |
| CN3 | I²C Qwiic expansion |
| J3 | Future SPI expansion only (not base alt firmware) |

---

## 6. Safety and Reliability

### 6.1 Electrical safety (alternator)

- Fail-safe: invalid sensors → field off
- Hard ceilings: current, temp, **VBus 14.4 V** (named constants in firmware)
- Charge regulation never targets above **Absorption** (capped at 14.4 V)
- Opto isolation on ENBL / RPM; ESD on sensor paths
- Test mode simulates current and bypasses ENBL — production must disable

### 6.2 Marine environment

- Engine-room install: metal RF; plan Wi-Fi AP placement or accept local PID with flaky telemetry
- IP65+ enclosures recommended for exposed nodes
- Shunt: twisted Kelvin pair only

### 6.3 Software reliability

- Setpoints `restore_value` across reboot
- Fallback Wi-Fi AP per device
- OTA via ESPHome; USB-C on Marine Board for brick recovery

---

## 7. Performance

| Item | Spec |
|------|------|
| Control loop | 1 Hz |
| Field PWM | ~4 kHz, GPIO38 |
| Current (shunt + INA226) | Design for ±1 A class resolution; calibrate on vessel |
| Voltage (VBus) | 0.01 V class display; hard trip 14.4 V |
| Temperature | DS18B20 ~0.1 °C resolution |

---

## 8. Configuration Management

### 8.1 Repository layout (relevant)

```
SisuAssistant/
  Technical Specifications.md          ← this file (system)
  MarineBoardSpecs/Technical Specs.md  ← PCB / GPIO
  homeassistant/
    esphome/alternatorport.yaml / alternatorstarboard.yaml
    esphome/packages/marine_*.yaml
    esphome/freezer.yaml               ← LilyGo AMOLED
    esphome/waterlevels.yaml           ← legacy; migrate to Marine Board
    automations.yaml
    docker-compose.yml
    secrets.yaml
  .ai_context/                         ← agent memory (INDEX, safety, …)
```

### 8.2 Secrets

- Prefer `!secret` / `secrets.yaml`; do not expand new plaintext keys in device YAML

---

## 9. Deployment Roles (summary)

| Location | Hardware | Function |
|----------|----------|----------|
| Nav station / locker (dry) | **HA Green** | Home Assistant |
| Nav station / locker (dry) | **TerraMaster F8 SSD Plus** | MQTT, Signal K, Grafana/Influx, backups |
| Engine Port | Marine Board | Alternator Port PID + charge; N2K later |
| Engine Starboard | Marine Board | Alternator Starboard PID + charge |
| Saloon / tanks | Marine Board | Levels + house voltage sense |
| Aft cockpit | **LilyGo S3 AMOLED** | Fridge/freezer |
| Helm | **Veratron OL43** (planned) | Daylight N2K gauges (engine, fuel) |

Infrastructure detail: **`NETWORK.md`**.

---

## 10. Compliance and Standards (intent)

- Marine electrical practice: ABYC E-11 / ISO 10133 oriented
- NMEA 2000 / ISO 11898 CAN on Marine Board when gateway enabled
- MQTT 3.x; HA / ESPHome current stable

---

## 11. Reference Documents

| Document | Content |
|----------|---------|
| `MarineBoardSpecs/Technical Specs.md` | PCB power, GPIO map, connectors, J3, INA addresses |
| `MarineBoardSpecs` / Documentation PNGs | Schematic exports (ESP32, HEADER PINS, CAN, PWM, …) |
| `homeassistant/esphome/packages/marine_alternator.yaml` | Live alternator safety + charge logic |
| `homeassistant/esphome/freezer.yaml` | LilyGo freezer |
| `homeassistant/automations.yaml` | MQTT → Signal K bridge |
| `.ai_context/safety.md` | Agent-facing hard limits |
| Victron LiFePO4 / BMS NG docs | Charge voltages, tail current / 100% sync |
| Leece-Neville alternator data | Hardware ratings |

### Explicitly obsolete for alternator path

- LilyGo T7 as primary alternator controller  
- ADS1115 as primary alt current/voltage path  
- Cytron **MDDS60** as field driver  
- Single “voltage setpoint 14.4 only” without float/absorption stages  

---

## 12. Revision History

| Ver | Date | Notes |
|-----|------|--------|
| 1.x | 2025 | Initial: LilyGo T7 + ADS1115 + MDDS60 |
| **2.0** | **Jul 2026** | Marine Board for alts + levels; Victron charge stages; freezer LilyGo AMOLED |
| **2.1** | **Jul 2026** | HA Green + F8 topology; Wi‑Fi 7 / Sisu-IoT routing; Veratron helm; Grafana/Influx — see **`NETWORK.md`** |

---

**Sisu Marine Automation — system specification.** Board detail always wins in `MarineBoardSpecs/Technical Specs.md`.
