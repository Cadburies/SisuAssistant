# Sisu Marine Board — Technical Specification

**Board Name:** Sisu Marine Board — ESP32-S3 IoT Control Board  
**Version:** 1.3  
**Date:** July 2026  
**Status:** Aligned to schematic + latest `Documentation/*.png` exports (ESP32, HEADER PINS, …)  
**Audience:** Firmware (Sisu Mate / ESPHome / ESP-IDF), bring-up, and AI agents

A marine-grade ESP32-S3 control board for 12 V vessel applications: wireless connectivity, protected I/O, CAN (NMEA 2000 / SeaTalkNG class), high-current PWM drive, relay output, and power/level monitoring. **Not** a display host — UI belongs on HA / Signal K / a separate display node. **J3** is reserved for optional future SPI/QSPI expansion only.

---

## Overview

Built around **ESP32-S3-WROOM-2-N32R16V**, optimised for:

- Marine monitoring and control (NMEA 2000 / SeaTalkNG-compatible CAN)
- Battery-powered sensor / actuator nodes
- 4–20 mA industrial sensors (liquid level, pressure)
- Reliable 12 V switching and shunt-based current monitoring

Heavy I/O protection, opto-isolation on selected paths, multiple INA226 monitors, dual-source power (12 V battery + USB-C).

---

## Key Features

- **Wireless:** Wi-Fi 802.11b/g/n + Bluetooth 5 (LE)
- **Core:** Dual-core Xtensa LX7 @ up to 240 MHz
- **Power:** 12 V battery with LC filtering **or** USB-C 5 V — diode-OR into 3.3 V rail
- **Interfaces:**
  - CAN bus (ISO 11898, 250 kbps, NMEA 2000 / SeaTalkNG compatible)
  - High-current PWM low-side drive (MOSFET + gate driver)
  - SPDT 12 V relay output
  - 3× INA226 high-side / loop current monitors (I²C)
  - Opto-isolated digital inputs (RPM, Enable)
  - ESD-protected sensor / I²C expansion
  - 2× 4–20 mA current-loop inputs
- **User:** Reset & Boot buttons, status LED(s), active buzzer
- **Expansion:** **J3** 2×9 header — **future SPI/QSPI / spare GPIO only** (see below)
- **Programming:** USB-C (native USB)

---

## Microcontroller Module

| Parameter   | Specification                          |
| ----------- | -------------------------------------- |
| Module      | **ESP32-S3-WROOM-2-N32R16V** (U8)      |
| SoC         | ESP32-S3 (dual-core Xtensa LX7)        |
| Clock       | Up to 240 MHz                          |
| Flash       | 32 MB (Octal SPI)                      |
| PSRAM       | 16 MB (Octal)                          |
| Antenna     | On-board PCB antenna                   |
| Do not use  | GPIO33–37 (octal flash/PSRAM internal) |

---

## GPIO map (firmware authority)

**Source of truth (in order):** (1) `MarineBoard.kicad_sch` nets, (2) `Documentation/ESP32.png`, (3) `Documentation/HEADER PINS.png` for connectors/J3.  
Use **GPIO numbers** in firmware, not module pin numbers, unless debugging hardware.

### Core functions (base product — always wired)

| GPIO | Module pin | Net name      | Direction / role | Notes |
| ---- | ---------- | ------------- | ---------------- | ----- |
| **EN** | 3 | `RESET` | Input (module enable) | Reset button to GND; pull-up to 3.3 V |
| **0** | 27 | `BOOT` | Input | Boot button to GND; hold + reset → download mode |
| **1** | 39 | `LED` | Output | Status LED (active high via series R) |
| **2** | 38 | `BUZZ` | Output | Active buzzer drive |
| **4** | 4 | `RPM_GPIO` | Input | Opto-isolated RPM input (PC817) |
| **7** | 7 | `RLY1_GPIO` | Output | Relay coil drive via optocoupler |
| **8** | 12 | `ENBL_GPIO` | Input | Opto-isolated enable input (PC817) |
| **15** | 8 | `TMP1_GPIO` | Input / 1-Wire | Field `TMP1` on U13 — intended **DS18B20**; 10 kΩ pull-up + ESD |
| **19** | 13 | `USB_D−` | USB | Native USB; programming / CDC |
| **20** | 14 | `USB_D+` | USB | Native USB |
| **38** | 31 | `PWM1_GPIO` | Output | PWM → opto → TC4427 → MOSFET |
| **40** | 33 | `SDA` / `S_GPIO+` | I²C SDA | INA226 bus + CN3 Qwiic |
| **41** | 34 | `SCL` / `S_GPIO−` | I²C SCL | INA226 bus + CN3 Qwiic |
| **43** | 37 | `CAN TX_GPIO` | Output | To CAN transceiver TXD |
| **44** | 36 | `CAN RX_GPIO` | Input | From CAN transceiver RXD |

### I²C device addresses (same bus as GPIO40/41)

| Device | Ref | Address | Measures |
| ------ | --- | ------- | -------- |
| INA226 battery | U2 | **0x40** | External 400 A / 75 mV shunt (`SH+` / `SH−`) |
| INA226 level 1 | U18 | **0x41** | 4–20 mA loop LVL1 (3.9 Ω sense) |
| INA226 level 2 | U19 | **0x45** | 4–20 mA loop LVL2 (3.9 Ω sense) |

Pull-ups: 10 kΩ on SDA/SCL (reduce to 4.7 kΩ if Fast Mode issues). External devices may hang off **CN3**.

### INA226 calibration (firmware)

Battery (400 A / 75 mV shunt):

```
Current_LSB = 400 / 32768 ≈ 12.2 mA/bit
Cal = 0x08BD
```

Level loops (3.9 Ω, 20 mA FS):

```
Current_LSB = 0.020 / 32768 ≈ 0.61 µA/bit
Cal = 0x0869
```

### Pins not available / unused on U8

| Pins | Reason |
| ---- | ------ |
| GPIO33–37 | Octal flash + PSRAM (module internal) |
| GPIO45, 46, 48 | **NC** on module sheet (not routed) |
| GPIO47 | Only on **J3** (`FSPITI/GPIO47`) — expansion only |

### Expansion GPIOs (routed only to J3 — not base firmware)

| GPIO | Net on ESP32 sheet | J3 role |
| ---- | ------------------ | ------- |
| 3 | `GPIO3` | Spare (strapping) |
| 5 | `GPIO5` | Spare |
| 6 | `GPIO6` | Spare |
| 9 | `FSPIHD/GPIO9` | QSPI HD / IO3 |
| 10 | `FSPICS0/GPIO10` | SPI CS0 |
| 11 | `FSPID/GPIO11` | SPI MOSI |
| 12 | `FSPICLK/GPIO12` | SPI SCK |
| 13 | `FSPIQ/GPIO13` | SPI MISO |
| 14 | `FSPIWP/GPIO14` | QSPI WP / IO2 |
| 16 | `GPIO16` | Spare |
| 17 | `FSPIRST/GPIO17` | Panel RST |
| 18 | `FSPIBL/GPIO18` | Backlight |
| 21 | `FSPIDC/GPIO21` | DC / RS |
| 39 | `FSPICS1/GPIO39` | CS1 |
| 42 | `FSPITE/GPIO42` | TE |
| 47 | `FSPITI/GPIO47` | Touch INT |

---

## J3 — future expansion header (not base firmware)

**Refdes:** J3 — `Conn_02x09_Top_Bottom` (2×9 = 18 pins)  
**Role:** Optional **SPI / QSPI display or peripheral** breakout and spare GPIOs.  
**Pin numbering authority:** `Documentation/HEADER PINS.png` (matches schematic labels).

**Policy for Sisu Mate:**

- Do **not** assign base product features (CAN, PWM, relay, RPM, ENBL, I²C monitors, USB, TMP1) to these pins.
- Leave **unconfigured / high-Z** unless a product variant explicitly enables an expansion device.
- Prefer the **GPIO number** in the net name when writing firmware.

### J3 signal map (official connector pin numbers)

Layout: **2 rows × 9** — pin **1** adjacent to pin **10**, pin **9** adjacent to pin **18**.

| J3 pin | Net | ESP32 GPIO | Suggested SPI role (future) |
| ------ | --- | ---------- | --------------------------- |
| **1** | `+3.3V` | — | Logic power (shared rail — budget carefully) |
| **2** | `FSPICS0/GPIO10` | **10** | SPI CS0 |
| **3** | `FSPIRST/GPIO17` | **17** | Panel reset |
| **4** | `FSPIDC/GPIO21` | **21** | DC / RS |
| **5** | `FSPID/GPIO11` | **11** | SPI MOSI (FSPID) |
| **6** | `FSPICLK/GPIO12` | **12** | SPI SCK |
| **7** | `FSPIBL/GPIO18` | **18** | Backlight enable / PWM |
| **8** | `GPIO6` | **6** | Spare |
| **9** | `GND` | — | Ground |
| **10** | `FSPIQ/GPIO13` | **13** | SPI MISO (FSPIQ) |
| **11** | `FSPITE/GPIO42` | **42** | TE (optional) |
| **12** | `FSPITI/GPIO47` | **47** | Touch INT (optional) |
| **13** | `FSPICS1/GPIO39` | **39** | Extra CS1 |
| **14** | `FSPIHD/GPIO9` | **9** | QSPI HD / IO3 |
| **15** | `FSPIWP/GPIO14` | **14** | QSPI WP / IO2 |
| **16** | `GPIO16` | **16** | Spare |
| **17** | `GPIO5` | **5** | Spare |
| **18** | `GPIO3` | **3** | Spare (strapping — prefer output after boot) |

**Typical future SPI TFT (minimal):** GPIO12 SCK, 11 MOSI, 13 MISO, 10 CS, 21 DC, 17 RST, 18 BL — plus J3 pins 1/9 (3V3/GND).  
**QSPI:** add GPIO9 + GPIO14 as data lines.  
**Not** a parallel RGB 800×480 port — wrong pin budget and wrong product intent (use a network display).

---

## Power supply

### Architecture

```
+12V Battery → protection/filter → TPS5430 (12V→5V) → diode ──┐
                                                                ├── VCC5V → SY8089 (5V→3.3V) → +3.3V
USB-C VBUS  ─────────────────────────────────── diode ─────────┘
```

| Rail | Source | Max (IC) | Used by |
| ---- | ------ | -------- | ------- |
| +12 V BAT | Battery (filtered) | Fuse-limited | Relay coil domain, PWM load side, 4–20 mA loop supply |
| VCC5V | TPS5430 or VBUS | ~3 A (TPS5430) | SY8089 input |
| +3.3 V | SY8089 | ~2 A | ESP32, CAN, INA226, logic, J3 3V3 |

### Protection (12 V input)

| Item | Function |
| ---- | -------- |
| Reverse diode | Reverse polarity |
| Blade fuse F1 | Input overcurrent |
| SMBJ18A TVS | Load dump / transients |
| LC + damping | Differential filter before buck |

USB-C: CC 5.1 kΩ sink, ESD on D±, Schottky on VBUS (no back-feed).  
**Note:** USB-C powers logic/programming only. Relay, PWM load, and loop supply need **12 V battery**.

---

## Interfaces (as built)

### CAN (NMEA 2000 / SeaTalkNG class)

| Item | Spec |
| ---- | ---- |
| Transceiver | **SN65HVD230DR** (U11) — 3.3 V |
| MCU pins | **GPIO43 TX**, **GPIO44 RX** |
| Speed | 250 kbps |
| Protection | PESD1CAN + DLW21SN900SQ2L CMC + 47 nF bus caps |
| Termination | **JP1** + 120 Ω (only if this board is a bus end) |
| Connector | **U7** DB125-3.5-3P: CANL, CANH, GND |

SeaTalkNG: use a commercial spur adapter; only **two** 120 Ω terminations per backbone.

### PWM output

| Item | Spec |
| ---- | ---- |
| MCU | **GPIO38** (`PWM1_GPIO`) |
| Path | GPIO → 1 kΩ → **PC817** opto → **TC4427** gate driver → **IPL60R075CFD7** MOSFET |
| Load connector | **CN2**: PWM1 (switched), +12V BAT |
| Sense/feedback net | `PWM1_DRIVE` (drain / switched node) |
| Practical continuous | **~10 A** thermally limited (PCB copper); fuse on path (F3 15 A class in design) |
| External | Load-side fusing still recommended for inductive loads |

### Relay

| Item | Spec |
| ---- | ---- |
| MCU | **GPIO7** (`RLY1_GPIO`) via optocoupler |
| Relay | SRD-12VDC SPDT |
| Contacts | **U12**: NC1, CO1, NO1 |

### Digital / sensor inputs

| Field signal | MCU net | GPIO | Isolation |
| ------------ | ------- | ---- | --------- |
| RPM | `RPM_GPIO` | 4 | PC817 opto + ESD on field side |
| ENBL | `ENBL_GPIO` | 8 | PC817 opto + ESD |
| TMP1 (DS18B20 1-Wire) | `TMP1_GPIO` | 15 | 10 kΩ pull-up + ESD + 120 Ω series (see IO PROTECTION) |
| Connector | **U13**: ENBL, RPM, TMP1 | | |

### 4–20 mA levels

| Loop | Connector | INA226 | Address |
| ---- | --------- | ------ | ------- |
| LVL1 | **U5** (LVL1, +12 V) | U18 | 0x41 |
| LVL2 | **U6** (LVL2, +12 V) | U19 | 0x45 |

Sense resistor 3.9 Ω on-board (within INA226 ±81.92 mV range). Target sensors: SW-LT100 class 2-wire 12 V loop.

### Battery shunt

| Item | Spec |
| ---- | ---- |
| Connector | **U4**: SH−, SH+ (sense only) |
| Monitor | U2 INA226 @ 0x40 |
| External | 400 A / 75 mV shunt, **Kelvin** twisted pair |

### I²C user connector

| Item | Spec |
| ---- | ---- |
| **CN3** | SM04B-SRSS-TB (Qwiic / STEMMA QT style) |
| Pins | 1 GND, 2 +3.3 V, 3 **SDA**, 4 **SCL** (also pads 5/6 GND on footprint) |

### Power / load connectors (field)

| Ref | Function | Signals |
| --- | -------- | ------- |
| **CN1** | Battery in | GND, +12V BAT |
| **CN2** | PWM power | +12V BAT, PWM1 |
| **U9** | Logic power out | +3.3 V, +5 V, GND |
| **J1** | USB-C | Program / serial / optional 5 V in |

---

## Electrical ratings

| Parameter | Value |
| --------- | ----- |
| Battery input | 9–15 V DC nominal 12 V |
| Logic | 3.3 V only on ESP32 GPIOs — never 5 V |
| CAN | 250 kbps |
| I²C | 100 kHz recommended (400 kHz with stronger pull-ups) |
| Ambient | −40 °C to +65 °C (module-limited) |

---

## Firmware notes (Sisu Mate)

### Board identity

- Target module: `esp32-s3-devkitc-1` / variant `esp32s3` with **octal PSRAM** if PSRAM used.
- Product role: **I/O + CAN + monitoring node** publishing to Home Assistant / MQTT / Signal K.
- **Do not** implement large RGB UI on this MCU; use network displays.

### Suggested ESPHome / IDF pin constants

```text
CAN_TX     = GPIO43
CAN_RX     = GPIO44
I2C_SDA    = GPIO40
I2C_SCL    = GPIO41
PWM1       = GPIO38
RELAY1     = GPIO7
RPM_IN     = GPIO4
ENBL_IN    = GPIO8
TMP1       = GPIO15
LED        = GPIO1
BUZZER     = GPIO2
BOOT       = GPIO0   # button; usually leave as boot strap
```

### CAN

- Controller: ESP32-S3 TWAI/CAN @ **250 kbit/s**
- TX/RX GPIOs **43/44** (UART0 pins reused — use **USB** for console, not UART0 on 43/44)

### Bring-up order

1. USB-C flash (Boot + Reset)
2. LED / buzzer smoke test
3. I²C scan → 0x40, 0x41, 0x45
4. CAN silent monitor on NMEA backbone (termination JP1 only if end node)
5. PWM / relay only with 12 V applied and safe load

### J3 / expansion firmware

- Default: no drivers on J3 GPIOs
- If SPI panel added: configure only documented J3 GPIOs; keep base I/O map unchanged

---

## Programming

1. Connect USB-C  
2. Hold **Boot** (Flash1), tap **Reset** → download mode  
3. Flash (ESP-IDF / Arduino / ESPHome)  
4. Release Boot, tap Reset to run  

---

## Known limitations

- USB-C does **not** power 12 V loads (relay, PWM output stage, loop supply)
- CAN termination (**JP1**) only at backbone ends
- All ESP32 GPIOs are **3.3 V**
- Shunt sense is mV-level — twisted Kelvin pair required
- J3 3.3 V share is limited by SY8089 budget (ESP + CAN + INA + expansion)
- GPIO3 is a strapping pin — if used via J3, prefer stable output after boot
- Keep `Documentation/*.png` exports in sync after schematic edits (agents and humans both use them)

---

## Resources

- Schematic: `MarineBoard.kicad_sch`
- Pin sheet: `Documentation/ESP32.png`
- Connectors + **J3 pin numbers**: `Documentation/HEADER PINS.png`
- Subcircuits: `Documentation/CAN INTERFACE.png`, `PWM DRIVERS.png`, `IO PROTECTION.png`, `LEVELS MONITOR.png`, etc.
- [ESP32-S3-WROOM-2 Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-2_datasheet_en.pdf)
- INA226, SN65HVD230, TPS5430 vendor datasheets

---

## Revision history

| Ver | Date | Notes |
| --- | ---- | ----- |
| 1.1 | Apr 2026 | Schematic review complete (prior draft) |
| 1.2 | Jul 2026 | Corrected GPIO/connector map from schematic; J3 as future FSPI expansion; Sisu Mate pin table |
| 1.3 | Jul 2026 | Re-synced to updated Documentation PNGs; **fixed J3 pin 1–18 order** from HEADER PINS; TMP1 = DS18B20 1-Wire |

---

**Made for the open-source marine community — Sisu.**
