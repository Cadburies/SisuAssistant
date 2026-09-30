# Sisu Marine Board — Technical Specification

**Board Name:** Sisu Marine Board — ESP32-S3 IoT Control Board  
**Version:** 1.9  
**Date:** Sep 2026  
**Status:** v1.9 board spin — aligned to schematic + routed board; fab package rebuilt by `fab_package.py` (Sep 2026). `Documentation/*.png` can lag — the schematic wins  
**Audience:** Firmware (Sisu Mate / ESPHome / ESP-IDF), bring-up, and AI agents

A marine-grade ESP32-S3 control board for 12 V vessel applications: wireless connectivity, protected I/O, CAN (NMEA 2000 / SeaTalkNG class), high-current PWM drive, relay output, and power/level monitoring. Not a display board — primary UI stays on HA / Signal K; **CN4** is an optional 10-pin header for a small SPI display or as unprotected spare 3.3 V GPIO.

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
- **User:** Reset & Boot (Flash) buttons, **RGB status LED** (WS2812B-2020, D5), power LED (D16), magnetic buzzer (KLJ-4020)
- **Expansion:** **CN4** 10-pin JST-GH, **vertical, top side** (BM10B-GHS-TBT) — small SPI display or spare GPIO, **unprotected 3.3 V only** (see below)
- **Programming:** USB-C (native USB)

---

## Microcontroller Module

| Parameter  | Specification                          |
| ---------- | -------------------------------------- |
| Module     | **ESP32-S3-WROOM-2-N32R16V** (U8)      |
| SoC        | ESP32-S3 (dual-core Xtensa LX7)        |
| Clock      | Up to 240 MHz                          |
| Flash      | 32 MB (Octal SPI)                      |
| PSRAM      | 16 MB (Octal)                          |
| Antenna    | On-board PCB antenna                   |
| Do not use | GPIO33–37 (octal flash/PSRAM internal) |

---

## GPIO map (firmware authority)

**Source of truth (in order):** (1) `MarineBoard.kicad_sch` nets, (2) `MarineBoard.kicad_pcb` for connector pin positions. `Documentation/*.png` exports can lag the schematic (#177).  
Use **GPIO numbers** in firmware, not module pin numbers, unless debugging hardware.

### Core functions (base product — always wired)

| GPIO   | Module pin | Net name          | Direction / role      | Notes                                                                             |
| ------ | ---------- | ----------------- | --------------------- | --------------------------------------------------------------------------------- |
| **EN** | 3          | `RESET`           | Input (module enable) | Reset button to GND; pull-up to 3.3 V                                             |
| **0**  | 27         | `BOOT`            | Input                 | Boot button to GND; hold + reset → download mode                                  |
| **1**  | 39         | `LED`             | Output                | RGB status LED **D5** WS2812B-2020 data in (via R34 100 Ω; D5 VDD = +5V_VCC). Not a plain GPIO LED — drive with `esp32_rmt_led_strip`, GRB |
| **2**  | 38         | `BUZZ`            | Output                | Magnetic buzzer. Use firmware helpers (not a static GPIO) — see **Buzzer** below. |
| **4**  | 4          | `RPM_GPIO`        | Input                 | Opto-isolated RPM input (PC817)                                                   |
| **7**  | 7          | `RLY1_GPIO`       | Output                | Relay coil drive via optocoupler                                                  |
| **8**  | 12         | `ENBL_GPIO`       | Input                 | Opto-isolated enable input (PC817)                                                |
| **15** | 8          | `TMP1_GPIO`       | Input / 1-Wire        | Field `TMP1` on U13 — intended **DS18B20**; 10 kΩ pull-up + ESD                   |
| **19** | 13         | `USB_D−`          | USB                   | Native USB; programming / CDC                                                     |
| **20** | 14         | `USB_D+`          | USB                   | Native USB                                                                        |
| **38** | 31         | `PWM1_GPIO`       | Output                | PWM → opto → MCP1407 → MOSFET (Q4)                                                      |
| **40** | 33         | `SDA` / `S_GPIO+` | I²C SDA               | INA226 bus + CN3 Qwiic                                                            |
| **41** | 34         | `SCL` / `S_GPIO−` | I²C SCL               | INA226 bus + CN3 Qwiic                                                            |
| **43** | 37         | `CAN TX_GPIO`     | Output                | To CAN transceiver TXD                                                            |
| **44** | 36         | `CAN RX_GPIO`     | Input                 | From CAN transceiver RXD                                                          |

### I²C device addresses (same bus as GPIO40/41)

| Device         | Ref | Address  | Measures                                     |
| -------------- | --- | -------- | -------------------------------------------- |
| INA226 battery | U2  | **0x40** | External 400 A / 75 mV shunt (`SH+` / `SH−`) |
| INA226 level 1 | U18 | **0x41** | 4–20 mA loop LVL1 (3.9 Ω sense)              |
| INA226 level 2 | U19 | **0x45** | 4–20 mA loop LVL2 (3.9 Ω sense)              |

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

| Pins           | Reason                                            |
| -------------- | ------------------------------------------------- |
| GPIO33–37      | Octal flash + PSRAM (module internal)             |
| GPIO3, 5, 6, 16, 17, 21, 39, 42, 47 | **NC** — not routed on this spin (spare pads on the module only) |
| GPIO45, 46                 | **NC** — strapping pins, leave unconnected |
| GPIO47, 48                 | **NC** — 1.8 V domain on N32R16V (octal PSRAM) |

### Display header GPIOs (CN4 — not base firmware)

| GPIO | Net              | CN4 role |
| ---- | ---------------- | -------- |
| 9    | `DC/GPIO9`       | DC / RS  |
| 10   | `CS0/GPIO10`     | SPI CS   |
| 11   | `MOSI/GPIO11`    | SPI MOSI |
| 12   | `SCK/GPIO12`     | SPI SCK  |
| 13   | `MISO/GPIO13`    | SPI MISO |
| 14   | `RST/GPIO14`     | Panel reset |
| 18   | `BL/GPIO18`      | Backlight enable / PWM |

None of these are strapping pins.

---

## CN4 — SPI display / peripheral header (not base firmware)

**Refdes:** CN4 — JST **BM10B-GHS-TBT** (LCSC C495732; GH series, 1.25 mm pitch, **vertical / top-entry, top side**, latching; 10 pins + 2 mounting pads to GND). Mates with standard JST-GH 10-pin cables.  
**Role:** Optional small SPI TFT or other SPI peripheral. Was **U10** (right-angle SM10B-GHS-TB on the bottom side) in v1.8; before that the J3 2×9 header and J2 QSPI FPC / H6 / H7 headers.

| CN4 pin | Net           | ESP32 GPIO | Role |
| ------- | ------------- | ---------- | ---- |
| **1**   | `+3.3V`       | —          | Logic power (shared SY8089 rail — budget carefully) |
| **2**   | `GND`         | —          | Ground |
| **3**   | `SCK/GPIO12`  | **12**     | SPI SCK |
| **4**   | `MOSI/GPIO11` | **11**     | SPI MOSI |
| **5**   | `MISO/GPIO13` | **13**     | SPI MISO |
| **6**   | `CS0/GPIO10`  | **10**     | SPI CS (pull up in firmware before bus init) |
| **7**   | `DC/GPIO9`    | **9**      | DC / RS |
| **8**   | `RST/GPIO14`  | **14**     | Panel reset |
| **9**   | `BL/GPIO18`   | **18**     | Backlight enable / PWM |
| **10**  | `+5V_VCC`     | —          | 5 V for backlight / panel (F2 1 A, shared with the 3.3 V buck input) |

**Not a display board.** The Marine Board is not designed to be a display host, but **CN4** can take a small SPI display (e.g. an ST7789 / ILI9341-class TFT) using the pinout above.

**CN4 as spare GPIO.** Instead of a display, the seven CN4 signals (GPIO 9, 10, 11, 12, 13, 14, 18) can be used as general-purpose GPIO for any other purpose, with 3.3 V and 5 V available on pins 1 and 10.

**⚠ No hardware I/O protection on CN4 — take care.** Every signal wires straight from the ESP32-S3 pin to the connector: no series resistor, no ESD/TVS clamp, no pull-up or pull-down. Anything above **3.3 V** on these pins (including the 5 V on CN4 pin 10 shorted to a signal pin, or a 5 V sensor output) will damage the ESP32-S3, possibly fatally. Use 3.3 V logic only, add a level shifter or series resistor + clamp for anything else, and enable pull-ups in firmware where a line needs a defined idle state. Treat CN4 as an internal, short-cable connector (display or peripheral in the same enclosure); do not run it off-board.

**Policy for Sisu Mate:** do **not** assign base product features to these pins; leave them unconfigured / high-Z unless a display variant enables them. Internal pull-ups are enough (pull CS high before bus init).

**Not** a parallel RGB port — for large UIs use a network display.

---

## Power supply

### Architecture

```
+12V Battery → protection/filter → TPS5430 (12V→5V) → diode ──┐
                                                                ├── VCC5V → SY8089 (5V→3.3V) → +3.3V
USB-C VBUS  ─────────────────────────────────── diode ─────────┘
```

| Rail      | Source             | Max (IC)       | Used by                                               |
| --------- | ------------------ | -------------- | ----------------------------------------------------- |
| +12 V BAT | Battery (filtered) | Fuse-limited   | Relay coil domain, PWM load side, 4–20 mA loop supply |
| VCC5V     | TPS5430 or VBUS    | ~3 A (TPS5430) | SY8089 input                                          |
| +3.3 V    | SY8089             | ~2 A           | ESP32, CAN, INA226, logic, CN4 3V3                    |

### Protection (12 V input)

| Item          | Function                        |
| ------------- | ------------------------------- |
| Reverse diode | Reverse polarity                |
| Blade fuse F1 | Input overcurrent — **2 A** (logic/buck/loop feed only; field path is fused by F3) |
| SMBJ18A TVS   | Load dump / transients          |
| LC + damping  | Differential filter before buck |

USB-C: CC 5.1 kΩ sink, ESD on D±, Schottky on VBUS (no back-feed).  
**Note:** USB-C powers logic/programming only. Relay, PWM load, and loop supply need **12 V battery**.

---

## Interfaces (as built)

### CAN (NMEA 2000 / SeaTalkNG class)

| Item        | Spec                                              |
| ----------- | ------------------------------------------------- |
| Transceiver | **SN65HVD230DR** (U11) — 3.3 V                    |
| MCU pins    | **GPIO43 TX**, **GPIO44 RX**                      |
| Speed       | 250 kbps                                          |
| Protection  | PESD1CAN + DLW21SN900SQ2L CMC + 47 nF bus caps    |
| Termination | **JP1** + 120 Ω (only if this board is a bus end) |
| Connector   | **U7** DB125-3.5-3P: pin 1 CANH, 2 CANL, 3 GND    |

SeaTalkNG: use a commercial spur adapter; only **two** 120 Ω terminations per backbone.

### PWM output

| Item                 | Spec                                                                             |
| -------------------- | -------------------------------------------------------------------------------- |
| MCU                  | **GPIO38** (`PWM1_GPIO`)                                                         |
| Path                 | GPIO → R29 1 kΩ → **U16 PC817** opto → **U23 MCP1407** gate driver → **Q4 BUK762R4-60E** MOSFET (TO-263); R40 10 kΩ gate pull-down |
| Load connector       | **CN2**: `PWM` (switched, via F3), +12V BAT                                      |
| Sense/feedback net   | `PWM_DRIVE` (drain / switched node); gate net `PWM_GATE`; **D8 VS-43CTQ100S** freewheel to +12V BAT; R31 100 Ω + C36 0.1 µF snubber |
| Practical continuous | **~10 A** thermally limited (PCB copper); **F3 10 A** blade fuse in the low-side path (CN2 → F3 → Q4), matched to the copper |
| External             | Load-side fusing still recommended for inductive loads                           |

### Relay

| Item     | Spec                                    |
| -------- | --------------------------------------- |
| MCU      | **GPIO7** (`RLY1_GPIO`) via optocoupler |
| Relay    | SRD-12VDC SPDT                          |
| Contacts | **U12**: NC1, CO1, NO1 — common fused by **F4 10 A** (CO1 → F4 → `RLY1_COM`), 12 V DC loads |

### Digital / sensor inputs

| Field signal          | MCU net                  | GPIO | Isolation                                              |
| --------------------- | ------------------------ | ---- | ------------------------------------------------------ |
| RPM                   | `RPM_GPIO`               | 4    | Alternator **phase lead** → C39 AC-couple → R16 10 k / R46 47 k (D20 clamp) → R47 2.2 k → **U21 PC817** → R48 47 k → **U22 74LVC1G14** Schmitt (INSTALLATION §6.3.7, #26) |
| ENBL                  | `ENBL_GPIO`              | 8    | PC817 opto + ESD                                       |
| TMP1 (DS18B20 1-Wire) | `TMP1_GPIO`              | 15   | 10 kΩ pull-up + ESD + 120 Ω series (see IO PROTECTION) |
| Connector             | **U13**: ENBL, RPM, TMP1 |      |                                                        |

### 4–20 mA levels

| Loop | Connector            | INA226 | Address |
| ---- | -------------------- | ------ | ------- |
| LVL1 | **U5** (pin 1 +12 V, 2 LVL1) | U18    | 0x41    |
| LVL2 | **U6** (pin 1 LVL2, 2 +12 V) | U19    | 0x45    |

Sense resistor 3.9 Ω on-board (within INA226 ±81.92 mV range). Target sensors: SW-LT100 class 2-wire 12 V loop.

### Battery shunt

| Item      | Spec                                         |
| --------- | -------------------------------------------- |
| Connector | **U4**: SH−, SH+ (sense only)                |
| Monitor   | U2 INA226 @ 0x40                             |
| External  | 400 A / 75 mV shunt, **Kelvin** twisted pair |

### I²C user connector

| Item    | Spec                                                                   |
| ------- | ---------------------------------------------------------------------- |
| **CN3** | SM04B-SRSS-TB (Qwiic / STEMMA QT style)                                |
| Pins    | 1 GND, 2 +3.3 V, 3 **SDA**, 4 **SCL** (also pads 5/6 GND on footprint) |

### Power / load connectors (field)

| Ref     | Function        | Signals                            |
| ------- | --------------- | ---------------------------------- |
| **CN1** | Battery in      | GND, +12V BAT                      |
| **CN2** | PWM power       | +12V BAT, PWM                      |
| **U9**  | Logic power out | +3.3 V, +5 V, GND                  |
| **J1**  | USB-C           | Program / serial / optional 5 V in |
| **CN4** | Display (SPI)   | 3V3, 5V, GND, SPI + DC/RST/BL — see CN4 section |

---

### Net classes (current / voltage ratings)

Every power net is a **named** net (no auto `Net-(…)` names) and belongs to a net class named `<ROLE>_<Vmax>_<Amps>` — e.g. `FIELD_15V_10A`, `RAIL_3V3_1A5` (1A5 = 1.5 A). Amps are the **fuse / source limit** for that copper (F1 2 A, F2 1 A, F3 10 A, F4 10 A), not typical draw; `+12V BAT` / `GND` carry F3 + F1 = 12 A.

| What | Where |
| --- | --- |
| Classes + net patterns (authoritative) | `MarineBoard.kicad_pro` → Board/Schematic Setup → Net Classes |
| Min-width / thermal-spoke rules (IPC-2221, 1 oz) | [`MarineBoard.kicad_dru`](MarineBoard.kicad_dru) |
| Quilter high-current CSV | `python3 quilter_nets.py` → `production/quilter_high_current_nets.csv` (regenerate after any class change) |

`+12V BAT`, `GND`, `PWM`, `PWM_DRIVE` and the relay nets must be **pours** on 1 oz copper (10–12 A needs ≥ 4.75 mm as a track). Switch nodes (`SW_5V`, `SW_3V3`) and `PWM_GATE` stay short and compact — no pour.

## Electrical ratings

| Parameter     | Value                                                |
| ------------- | ---------------------------------------------------- |
| Battery input | 9–15 V DC nominal 12 V                               |
| Logic         | 3.3 V only on ESP32 GPIOs — never 5 V                |
| CAN           | 250 kbps                                             |
| I²C           | 100 kHz recommended (400 kHz with stronger pull-ups) |
| Ambient       | −40 °C to +65 °C (module-limited)                    |

---

## Mechanical & fabrication

| Item | Value |
| --- | --- |
| Board outline | **83.0 × 67.5 mm** rectangle (Edge.Cuts (193.75, 37.75) → (276.75, 105.25)) |
| Mounting | 4 × 3.2 mm NPTH (M3) — H1–H4, ~3.5 mm in from the edges |
| Stackup | 4 layers, 1.6 mm FR4: **F.Cu** signal + pours · **In1 GND** plane · **In2 power** (split: +12V BAT, +12V, +3.3V, PWM, PWM_DRIVE) · **B.Cu** signal + pours |
| Copper | **1 oz** all layers (current ratings in the net classes assume it) |
| Finish | **ENIG** (0.5 mm-pitch INA226 / USB-C / MCP1407; flat pads; marine corrosion) |
| Vias | 0.6/0.3 mm default, 0.8/0.4 mm high-current, 0.554/0.254 mm tight spots; **all vias resin-filled + copper-capped (POFV / VIPPO)** — ordered from PCBWay Sep 2026 because thermal via arrays sit in the Q4 / D8 / U3 / U8 / U23 pads (plus a few routing vias in D15, D20/R46, D8 pads 1/3, C32 pads); capping keeps those pads flat and stops solder wicking |
| Design rules | Board Setup = stricter of project vs PCBWay; PCBWay-only limits in [`MarineBoard.kicad_dru`](MarineBoard.kicad_dru) |
| Fab package | **`python3 fab_package.py`** (KiCad closed) rebuilds all of `production/`: refills zones, gates on DRC errors + schematic parity, then writes `MarineBoard-PCBWay-Gerbers.zip` (4 copper, mask, paste, silk, outline, PTH/NPTH drill + maps, IPC-D-356 netlist), `MarineBoard-BOM.csv/.xlsx`, `MarineBoard-positions.csv/.xlsx` (xlsx = PCBWay assembly upload format) |
| Silkscreen | Sisu sails + wordmark logo, "MARINE BOARD" + board version (footprint **LOGO1**, `LCSC:Sisu_Logo`; version = its Value field — bump per spin) left of U8; **RESET** / **FLASH** labels above the buttons. All connectors and fuse holders are on the top side |
| Order sheet | `PCB Manufacturing Process Specification.xlsx` |

F1–F4 BOM lines are the **XF-506P holder** (C492610) — it takes **MINI blade** fuses (ATM/APM, 10.9 mm). `MarineBoard-BOM.csv` ends with 4 **LOOSE** rows (supplied, not mounted): Littelfuse 0297002 (2 A, F1), 0297001 (1 A, F2), 2 × 0297010 (10 A, F3/F4), and a 1.27 mm jumper shunt for JP1. They live in the `LOOSE` list in `fab_package.py`, which appends them on every build.

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
LED        = GPIO1   # v1.9+: WS2812B-2020 data (esp32_rmt_led_strip, GRB); v1.8: plain LED
BUZZER     = GPIO2
BOOT       = GPIO0   # button; usually leave as boot strap
```

### Buzzer

GPIO2 is a magnetic buzzer (KLJ-4020). **Do not drive it as a digital on/off** — a static high is silent.

**How to use** (`homeassistant/esphome/packages/marine_board_base.yaml`):

| From               | Action                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Device web UI / HA | Switch **Buzzer** on/off. Number **Buzzer tone Hz** sets the pitch first if you want a different alert. |
| YAML script        | `id(buzz_on).execute(2000);` then `id(buzz_off).execute();`                                             |
| C++ lambda         | `id(sys_buzz_out).update_frequency(2000.0f);` then `id(sys_buzz).turn_on();` / `turn_off();`            |

Use **different pitches (and/or on/off cadence) for different errors** so the sound itself says what is wrong. Alternator firmware today: warning (RPM gate) vs hard/latched fault. Add more tones the same way — pick a pitch, turn the helper on, pulse if you want a pattern.

Smoke test: turn **Buzzer** on from the device page; you should hear a tone.

### CAN

- Controller: ESP32-S3 TWAI/CAN @ **250 kbit/s**
- TX/RX GPIOs **43/44** (UART0 pins reused — use **USB** for console, not UART0 on 43/44)

### Bring-up order

1. USB-C flash (Boot + Reset)
2. Status LED (RGB on v1.9+) / buzzer smoke test (turn **Buzzer** on from the device web UI — see **Buzzer** above)
3. I²C scan → 0x40, 0x41, 0x45
4. CAN silent monitor on NMEA backbone (termination JP1 only if end node)
5. PWM / relay only with 12 V applied and safe load

### Status LED firmware (v1.9)

- [`marine_board_base.yaml`](../homeassistant/esphome/packages/marine_board_base.yaml) drives **D5** as an internal `esp32_rmt_led_strip` light with explicit bit timings for D5's tighter window (T0H 300 ns, T0L 950 ns, T1H 750 ns, T1L 700 ns, reset 300 µs). HA still sees the **Status LED** switch (plus a **Status LED brightness** number, default 35 %)
- Roles set `id(sys_led_color)` (0xRRGGBB) + `id(sys_led_owner) = true` and blink the switch; unowned boards (levels) get the base heartbeat: green flash = running, blue flash = HA API down, red blink = component error
- Alternator colours: blue idle/float, green charging, amber warning, red fault, purple shadow (blink patterns + buzzer unchanged). Freezer colours: see [`freezer_marineboard.yaml`](../homeassistant/esphome/freezer_marineboard.yaml)
- v1.8 boards (plain LED on GPIO1) only show a dim flicker with this firmware — harmless

### CN4 / display firmware

- Default: no drivers on CN4 GPIOs
- If an SPI panel is added: configure only the CN4 GPIOs (9–14, 18); keep the base I/O map unchanged

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
- CN4 3.3 V share is limited by the SY8089 budget (ESP + CAN + INA + display); CN4 5 V shares F2 (1 A) with the status LED
- **CN4 has zero hardware protection** (no series R / ESD clamp / pull) — internal short cable only
- GPIO3 is unconnected on this spin; if a future revision routes it, it has no internal pull (ESP32-S3-WROOM-2 datasheet §4.4) and is the JTAG-source strap — add an external ~10 kΩ pull
- Keep `Documentation/*.png` exports in sync after schematic edits (agents and humans both use them)

---

## Resources

- Schematic: `MarineBoard.kicad_sch`
- Pin sheet: `Documentation/ESP32.png`
- Connector pin numbers: this document + `Documentation/HEADER PINS.png`
- Subcircuits: `Documentation/CAN INTERFACE.png`, `PWM DRIVERS.png`, `IO PROTECTION.png`, `LEVELS MONITOR.png`, etc.
- [ESP32-S3-WROOM-2 Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-2_datasheet_en.pdf)
- INA226, SN65HVD230, TPS5430 vendor datasheets

---

## Revision history

| Ver | Date     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Apr 2026 | Schematic review complete (prior draft)                                                                                                                                                                                                                                                                                                                                                                                |
| 1.2 | Jul 2026 | Corrected GPIO/connector map from schematic; J3 as future FSPI expansion; Sisu Mate pin table                                                                                                                                                                                                                                                                                                                          |
| 1.3 | Jul 2026 | Re-synced to updated Documentation PNGs; **fixed J3 pin 1–18 order** from HEADER PINS; TMP1 = DS18B20 1-Wire                                                                                                                                                                                                                                                                                                           |
| 1.4 | Aug 2026 | Documented **J3 has no hardware I/O protection**; clarified GPIO3 strap has no internal pull (datasheet §4.4) and is only strapping-active if `EFUSE_STRAP_JTAG_SEL` is burnt; added J3 pull-up guidance. `RPM (new).png` (SH+ ripple-derived RPM input, not yet adopted) and `ESP32 (new).png` / `FSPI (new).png` (re-exports, no map change) noted — not yet merged into canonical GPIO map pending bench validation |
| 1.5 | Sep 2026 | Project libraries consolidated into `Lib/EasyEDA` (`0623` / `easyeda2kicad` / root `EasyEDA.pretty` retired). Imported FH12-18S QSPI symbol+footprint into EasyEDA; J3 footprint unchanged                                                                                                                                                                                                                             |
| 1.6 | Sep 2026 | Buzzer usage: PWM helpers in `marine_board_base.yaml` (`buzz_on` / `sys_buzz`); do not drive GPIO2 as a static high. Distinct pitches for distinct alerts. Bench-confirmed.                                                                                                                                                                                                                                            |
| 1.7 | Sep 2026 | Fuses resized to the copper: **F1 2 A**, **F3 10 A**, new **F4 10 A** on relay common. CN2 net fixed (`PWM1` label on CN2 did not join F3 `PWM` — field was open). Power nets named (`VIN_*`, `SW_*`, `5V_*`, `VBUS`, `PWM_GATE`, `RLY1_COM`), net classes rebuilt as `<ROLE>_<V>_<A>`, `MarineBoard.kicad_dru` rules + `quilter_nets.py` added |
| 1.8 | Sep 2026 | **Routed board / PCBWay release.** Board grew to **83.0 × 67.5 mm** (was 66.5 × 70) to fit the added protection (F4 relay fuse, fuse resize). **J3, J2 (QSPI FPC), H6, H7 removed**; **U10** is now a 10-pin JST-GH SPI display header (GPIO 9–14, 18). 4-layer stackup (In1 GND, In2 split power), 1 oz, ENIG; Mechanical & fabrication section added; GPIO3/5/6/16/17/21/39/42 now unrouted | RPM input sized for a phase-lead tap: **R16 47 k → 10 k 1 W**, **R48 10 k → 47 k** (#26).
| 1.9 | Sep 2026 | U10 usage clarified: board is not a display host, but U10 takes a small SPI display or serves as spare GPIO — **unprotected, 3.3 V max** (#177). `POWER AND FILTERING 12V_5V.png` re-exported (D14 SS56, F2 after L6); `changed components.png` WIP screenshot removed. **Board spin v1.9:** status LED → **WS2812B-2020 RGB (D5, C52917434)** on GPIO1 via R34 100 Ω, VDD +5V_VCC, C40 decoupling (D17 removed); **U10 → CN4** vertical JST-GH BM10B-GHS-TBT moved to the **top** side (pinout unchanged); all fuses/connectors on top; Sisu logo + version on silk, RESET/FLASH labels; GND stitching reworked; project libraries consolidated back into `Lib/` (root `EasyEDA.*` retired again), CN4 courtyard now covers its leads, L2 footprint attr THT → SMD; fab package rebuilt by new `fab_package.py`; U7/U5/U6 pin order in the tables corrected to the schematic (#179; firmware follow-up #180) |

---

Available GPIO pool (revised; GPIOs not marked "Used" are unrouted on this spin — pads only)

Pin GPIO Alt-functions Status
15 GPIO3 TOUCH3, ADC1_CH2 Available (strapping — JTAG source; fine to use as long as nothing holds it during reset)
5 GPIO5 TOUCH5, ADC1_CH4 Available
6 GPIO6 TOUCH6, ADC1_CH5 Available
17 GPIO9 TOUCH9, ADC1_CH8, FSPIHD, SUBSPIHD Used — CN4 display header
18 GPIO10 TOUCH10, ADC1_CH9, FSPICS0, FSPIIO4, SUBSPICS0 Used — CN4 display header
19 GPIO11 TOUCH11, ADC2_CH0, FSPID, FSPIIO5, SUBSPID Used — CN4 display header
20 GPIO12 TOUCH12, ADC2_CH1, FSPICLK, FSPIIO6, SUBSPICLK Used — CN4 display header
21 GPIO13 TOUCH13, ADC2_CH2, FSPIQ, FSPIIO7, SUBSPIQ Used — CN4 display header
22 GPIO14 TOUCH14, ADC2_CH3, FSPIWP, FSPIDQS, SUBSPIWP Used — CN4 display header
10 GPIO17 U1TXD, ADC2_CH6 Available
11 GPIO18 U1RXD, ADC2_CH7, CLK_OUT3 Used — CN4 display header
23 GPIO21 — Available
9 GPIO16 U0CTS, ADC2_CH5, XTAL_32K_N Available
32 GPIO39 MTCK, CLK_OUT3, SUBSPICS1 Available (JTAG-shared, fine — no JTAG needed)
35 GPIO42 MTMS Available (JTAG-shared, fine)
24 GPIO47 SPICLK_P_DIFF, SUBSPICLK_P_DIFF Available with caveat — 1.8V domain on your N32R16V (octal PSRAM VDD_SPI). Usable only behind a level shifter if anything on the other end is 3.3V logic.
25 GPIO48 SPICLK_N_DIFF, SUBSPICLK_N_DIFF Same 1.8V caveat as 47
16 GPIO46 — Not actually available — pushing back on this one. GPIO46 is one of the four hardware strapping pins (controls boot mode / ROM log output at reset). It needs to stay floating or match its default pull state; using it as a general-purpose signal risks intermittent boot failures depending on what else is toggling it at power-up. I'd leave this one alone regardless of what else changes.
26 GPIO45 Not available — strapping pin (VDD_SPI voltage select). Must stay floating/unused, same as GPIO46.x

**Made for the open-source marine community — Sisu.**
