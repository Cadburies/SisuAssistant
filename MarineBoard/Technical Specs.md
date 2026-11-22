# Sisu Marine Board — Technical Specification

**Board Name:** Sisu Marine Board — ESP32-S3 IoT Control Board  
**Version:** 1.10  
**Date:** Nov 2026  
**Status:** **v1.10 design — no board in production yet.** The five production boards are **v1.9** (PCBWay `W831004AS1P18`, silk v1.9); their design and fab package are archived in [`v1.9/`](v1.9/), with the [frozen release identity](v1.9/README.md). The root `production/` package remains the v1.9 order package; do not rebuild it for v1.10 until the design differences land. `Documentation/*.png` can lag — the schematic wins

**Prototype:** v1.00, retired 2026-10-20 (U3 failed) — see *v1.00 prototype (retired)*  
**Audience:** Firmware (Sisu Mate / ESPHome / ESP-IDF), bring-up, and AI agents

A marine-grade ESP32-S3 control board for 12 V vessel applications: wireless connectivity, protected I/O, CAN (NMEA 2000 / SeaTalkNG class), high-current PWM drive, relay output, and power/level monitoring. Not a display board — primary UI stays on HA / Signal K; **CN4** is an optional 10-pin header for a small SPI display or as unprotected spare 3.3 V GPIO.

## Version state

This document describes the **current v1.10 design**. There is no v1.10 production board. The five physical boards are **v1.9**.

| Version | Physical state | Authority |
|---|---|---|
| **v1.9** | five boards, PCBWay `W831004AS1P18` | [`v1.9/README.md`](v1.9/README.md) for identity; [`temp-fix-v1.9.md`](temp-fix-v1.9.md) for test actions and accepted risks |
| **v1.10** | source only, no board | this document; the reset has no copper delta from v1.9 yet |
| **Next spin** | none | [§ Next spin](#next-spin--decided-changes-not-fitted-on-v19) below; **not fitted on v1.9** |

A v1.9 question is answered from the v1.9 archive plus `temp-fix-v1.9.md`, not from the current design alone. The version-routing index is in [`README.md`](README.md#version-routing).

## Main board and daughter boards

The main board is the baseline and interface contract: 12 V input, field PWM, relay, CAN, I²C, opto inputs, level loops, and the connector set. Optional functions live in their own folder and spec, e.g. [`daughter-fridge/technical spec.md`](daughter-fridge/technical%20spec.md). If a daughter function moves onto the main board, that is a new **main-board revision** with a fitted-option row; do not fork or copy this spec.

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
| **5**  | 5          | `CAN TX_GPIO`     | Output                | To CAN transceiver TXD (moved off GPIO43/U0TXD in 1.9: ROM boot log would hit the bus) |
| **6**  | 6          | `CAN RX_GPIO`     | Input                 | From CAN transceiver RXD (moved off GPIO44/U0RXD in 1.9)                    |
| **7**  | 7          | `RLY1_GPIO`       | Output                | Relay coil drive via optocoupler                                                  |
| **8**  | 12         | `ENBL_GPIO`       | Input                 | Opto-isolated enable input (PC817)                                                |
| **15** | 8          | `TMP1_GPIO`       | Input / 1-Wire        | Field `TMP1` on U13 — intended **DS18B20**; 10 kΩ pull-up + ESD                   |
| **19** | 13         | `USB_D−`          | USB                   | Native USB; programming / CDC                                                     |
| **20** | 14         | `USB_D+`          | USB                   | Native USB                                                                        |
| **38** | 31         | `PWM1_GPIO`       | Output                | PWM → opto → MCP1407 → MOSFET (Q4)                                                      |
| **40** | 33         | `SDA` / `S_GPIO+` | I²C SDA               | INA226 bus + CN3 Qwiic                                                            |
| **41** | 34         | `SCL` / `S_GPIO−` | I²C SCL               | INA226 bus + CN3 Qwiic                                                            |

### I²C device addresses (same bus as GPIO40/41)

| Device         | Ref | Address  | Measures                                     |
| -------------- | --- | -------- | -------------------------------------------- |
| INA226 battery | U2  | **0x40** | External 400 A / 75 mV shunt (`SH+` / `SH−`) |
| INA226 level 1 | U18 | **0x41** | 4–20 mA loop LVL1 (R38 3.9 Ω shunt)          |
| INA226 level 2 | U19 | **0x45** | 4–20 mA loop LVL2 (R39 3.9 Ω shunt)          |

Pull-ups: 10 kΩ on SDA/SCL (reduce to 4.7 kΩ if Fast Mode issues). External devices may hang off **CN3**.

### INA226 calibration (firmware)

Battery (400 A / 75 mV shunt):

```
Current_LSB = 400 / 32768 ≈ 12.2 mA/bit
Cal = 0x08BD
```

Level loops (R38/R39 3.9 Ω shunt, 20 mA FS):

```
Current_LSB = 0.020 / 32768 ≈ 0.61 µA/bit
Cal = 0x0869
```

### Pins not available / unused on U8

| Pins           | Reason                                            |
| -------------- | ------------------------------------------------- |
| GPIO33–37      | Octal flash + PSRAM (module internal)             |
| GPIO3, 16, 17, 21, 39, 42, 43, 44, 47 | **NC** — not routed on this spin (spare pads on the module only). GPIO43/44 = UART0: ROM boot log on 43 at every reset |
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
| SMBJ18A TVS (D6) | Local transient clamp on `VIN_FUSED`, after F1/D14. **Not** a load-dump part: 600 W, 10/1000 µs class. No load-dump clamp is fitted on v1.9 — see *Next spin — inlet clamp* below. |
| LC + damping  | Differential filter before buck |

**TPS5430 buck (U3):** ENA (pin 5) left floating, so it auto-starts via the internal pull-up (ENA abs max 7 V, so never tie it to VIN). Output filter L5 15 µH + C20 220 µF **OS-CON polymer (ESR ≤ 40 mΩ)**, which is TI's internal-compensation reference design (datasheet SLVS632 §7.2.1). The ceramic-cap add-on network (TI Fig 7-11, a 3.3 V / 100 µF ceramic design) has been **removed** (was C21/C22/R13/C23). Only add one back if C20 becomes ceramic, recalculated for 5 V per datasheet eq 17–23. Feedback node net is `VSENSE` (TP6).

USB-C: CC 5.1 kΩ sink, ESD on D±, Schottky on VBUS (no back-feed).  
**Note:** USB-C powers logic/programming only. Relay, PWM load, and loop supply need **12 V battery**.

---

## Interfaces (as built)

### CAN (NMEA 2000 / SeaTalkNG class)

| Item        | Spec                                              |
| ----------- | ------------------------------------------------- |
| Transceiver | **SN65HVD230DR** (U11) — 3.3 V                    |
| MCU pins    | **GPIO5 TX**, **GPIO6 RX** (not UART0 — boot log)  |
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

| Path | Refs | Value | Footprint |
| --- | --- | --- | --- |
| Series | R35, R36 | 10 Ω ±5% | `Resistor_SMD:R_0805_2012Metric` |
| Shunt | R38, R39 | 3.9 Ω | `Resistor_SMD:R_0805_2012Metric` |

At 20 mA the pair drops 0.278 V (0.200 V series + 0.078 V shunt), leaving 11.72 V for a 12 V sensor; at 4 mA the drop is 0.056 V. The shunt sees 78 mV at 20 mA, within ±81.92 mV. A loop short leaves 13.9 Ω, so 0.86 A at 12 V; a shunt short leaves 10 Ω, so 1.2 A. All four are 0805 parts (0.125 W class), so a sustained short overloads them. There is no series fuse; fit an external fuse or PTC in the loop if a short is credible. Target sensors: SW-LT100 class 2-wire 12 V loop.

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

F1–F4 BOM lines are the **XF-506P holder** (C492610). It takes a MINI blade fuse (10.9 mm). The fuse is inserted into the soldered holder, and the JP1 shunt is fitted on the header. `fab_package.py` appends those rows on every build: Eaton Bussmann ATM-2 (2 A, F1), ATM-1 (1 A, F2), ATM-10 (10 A, F3 and F4), and BOOMELE 1.27 (LCSC C150949, the 1.27 mm shunt on JP1). Littelfuse MINI series 297 starts at 2 A, so the four blades are one Eaton series. 0297001.WXNV is not a real 1 A part.


## Enclosure

A printed, sealed two-part box (bottom + lid) with IP67 panel connectors. Source of truth is the parametric FreeCAD script; everything below comes from its constants, so change the script and rebuild rather than editing exports.

| Item | Value |
| --- | --- |
| Closed size | **129.4 × 107.9 × 44.0 mm** (bottom 129.4 × 107.9 × 40.8, lid 3.2); **129.4 × 135.9 mm** footprint over the mounting flanges. Inside 123 × 101.5 × 38 mm |
| Mounting | 4 mm flange along the outside of the north and south walls at floor level, 14 mm out; **4 × Ø4.5 mm** holes (M4 or #8), 15 mm from the east/west faces, clear of the south-wall plugs (#198) |
| Material | Nylon **PA12**, SLS or MJF, then a waterproof seal (impregnation or vapor smoothing; unsealed SLS is porous) |
| Walls | 3.2 mm walls, 2.8 mm floor, 6.5 mm outside corner radius |
| Board mount | 4 × 12 mm bosses on the floor at H1–H4 (12 mm clears L2, which hangs 8.6 mm below the board); **4 × M3×6** stainless self-tapping pan head into Ø2.7 mm blind pilots, so nothing pierces the floor |
| Board position | Centered east–west with 20 mm gutters; 20 mm south gutter (relay / CN1 / CN2 / power); 14 mm north (U9 / antenna side). FreeCAD +Y = north = top of the KiCad 3D view |
| Lid | Drops on with a 1.5 mm locating lip; 2 × 2 grid of 2 mm ribs, 5 mm deep, on the underside inside the lip, so the lid stays flat on the seal (#198); **4 × M3×10** stainless self-tapping pan head in the corners (Ø2.6 mm pilot, 9 mm deep), outside the seal |
| Seal | **Ø2.0 mm round silicone cord** pressed into a 2.0 × 1.3 mm groove on the bottom's top rim (stands ~0.7 mm proud); about 500 mm per box |
| Status light | Ø5.2 mm hole + boss in the lid over **D5**: Ø5.0 mm clear acrylic/PC rod as a light pipe, sealed in the glue well with neutral-cure silicone |
| USB | **No USB-C opening**: first flash with the board out, then OTA. The north wall has no connectors |

**Panel connectors.** Male halves fit in the walls with the matching female plugs inserted (no wires); PCBWay ships the enclosure assembled this way. Pin legends are laser-marked on the outside of the west, south and east walls from the Illustrator files `enclosure/MarineBoard-enclosure-west.ai`, `-south.ai` and `-east.ai`; the walls themselves are flat (no engraving). Legends read one pin name per line with the first pin on top, above each hole, except the LP20's, which goes to its right because the wall above that hole is too short.

| Wall | Legend (pin order) | Connector | Hole |
| --- | --- | --- | --- |
| West (opposite U13) | TMP / RPM / ENBL | 12G IP67, 4-pin (one spare) | Ø12.4 |
| South (opposite F1) | GND / +12V / PWM | **EW-LP20** (M22) 3-pin front-mount, wire-locking | Double-D: Ø22.5 +0.2, flats 20.0 +0.2 (modelled Ø22.7 / 20.2) |
| South (opposite U12) | NO / CO / NC | 12G IP67, 4-pin (one spare) | Ø12.4 |
| East, north hole (U7) | CAN | **M12 5-pin** rear-mount flange (male socket) | Ø12.4 |
| East, middle (U4) | SH− / SH+ | 12G IP67, 4-pin (two spare) | Ø12.4 |
| East, south hole (U5/U6) | LVL2 / +12V / LVL1 | 12G IP67, 4-pin (one spare) | Ø12.4 |

East holes are on a 20 mm pitch (the board terminals are 7.5–9.5 mm apart, too close for Ø12.4 holes). The LP20 body reaches inward past the south gutter. Connector holes are modelled from listing panel sizes; if a delivered part differs, change the constant and rebuild. Wiring from each panel connector to its board terminal is done at assembly.

**Files** (`enclosure/`):

| File | What |
| --- | --- |
| [`make_enclosure.py`](enclosure/make_enclosure.py) | Builds both parts (FreeCAD 1.0): `freecadcmd MarineBoard/enclosure/make_enclosure.py` |
| [`fit_board.py`](enclosure/fit_board.py) | Drops the KiCad board STEP into the box and reports clearances (export steps in its header) |
| `MarineBoard-enclosure-bottom.step` / `-body.stl` | Bottom: geometry reference / print mesh (opening up) |
| `MarineBoard-enclosure-top.step` / `-lid.stl` | Lid: geometry reference / print mesh (already rotated for printing) |
| `MarineBoard-enclosure.step`, `MarineBoard-board.step`, `*.FCStd`, `MarineBoard.png` | Assembly, board model, FreeCAD documents, render |

**Ordering:** [`Documentation/MarineBoard-enclosure-PCBWay-BOM.xlsx`](Documentation/MarineBoard-enclosure-PCBWay-BOM.xlsx) is the print + parts order sheet (printed parts, connectors with links, screws, cord, light pipe, sealant, fit rules); the connector shopping list is `Documentation/Enclosure Connector model and purchase link—10.9.xlsx`.

**Superseded:** `v1.00/PCBWay delivery 2026-08-15/Enclosure Design File (superseded)/` is PCBWay's earlier box (STEP/DXF, 4 × M3×5 board screws, 3 × M3×10 lid screws, no connector holes). Do not reuse it.

---

## Firmware notes (Sisu Mate)

### Board identity

- Target module: `esp32-s3-devkitc-1` / variant `esp32s3` with **octal PSRAM** if PSRAM used.
- Product role: **I/O + CAN + monitoring node** publishing to Home Assistant / MQTT / Signal K.
- **Do not** implement large RGB UI on this MCU; use network displays.
- Schematic title block: Title `Sisu Marine Board`, Company `Sisu`; `scripts/marineboard-version-bump.py` sets Rev and Date with each version bump.

### Suggested ESPHome / IDF pin constants

```text
CAN_TX     = GPIO5
CAN_RX     = GPIO6
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
- Alternator colours: blue idle/float, green charging, amber warning, red fault, purple shadow (blink patterns + buzzer unchanged). Freezer colours (v1.9+ only; v1.00 has a plain LED): see [`freezer_marineboard.yaml`](../homeassistant/esphome/freezer_marineboard.yaml)
- v1.00 and v1.8 boards (plain LED on GPIO1) only show a dim flicker with this firmware — harmless

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

## v1.00 prototype (retired)

The first board built is **v1.00**, from the PCBWay delivery of 2026-08-15. **Retired 2026-10-20:** U3 (TPS5430 5 V buck) burnt during freezer bring-up aboard. The failure matches the U3 EN erratum below; the root cause is not confirmed. The board was not repaired. KiCad files: [`v1.00/`](v1.00/), byte-identical to `v1.00/PCBWay delivery 2026-08-15/Design Files/`. Everything else in this document describes the current spin (v1.10); production boards are v1.9. The errata stay here as the record of why v1.9 changed.

These are the same on v1.00: Relay1 GPIO7, TMP1 GPIO15, I²C GPIO40/41, U2 INA226 @ 0x40, RPM GPIO4, PWM1 GPIO38, ENBL GPIO8, BUZZ GPIO2, Flash GPIO0, USB GPIO19/20.

Errata against v1.9:

| v1.00 | Effect | Fixed in | Prototype action (history) |
| --- | --- | --- | --- |
| U2 INA226 **VBUS reaches Vin+ only through series cap C10** | Bus (house) voltage reads nothing | 1.9: VBUS tied to Vin+, C10 removed | **Rework: bridge C10 with 0 Ω** (solder link or 0 Ω part) |
| U3 TPS5430 **EN tied to 12 V VIN** | Over its 7 V absolute maximum; the 5 V buck may fail early | 1.9: EN floating (internal pull-up enables it) | Optional rework: lift U3 pin 5. Watch for a dead 5 V rail |
| GPIO1 status LED is a **plain LED (D17)** | The firmware's RGB status colours show only as a dim flicker | 1.9: WS2812B-2020 (D5) | None: status is shown elsewhere |
| CAN on **GPIO43 TX / GPIO44 RX** (UART0) | CAN firmware for v1.9 (GPIO5/6) does not match | 1.9: GPIO5/6 | Do not use CAN on v1.00 |
| U15 TC4427 gate driver VDD on raw `+12V BAT` | Gate driver unprotected by the input fuse/diode | 1.9: U23 MCP1407 on protected `+12V` | Not used on the freezer (no field drive) |
| No CN4 header, no test pads TP1–TP6; spare GPIOs on **JPx** pads | Different spare-I/O access | 1.9 / 1.10 | None |

---

## Next spin — decided changes (not fitted on v1.9)

These are decisions for the next board spin. The v1.9 boards (PCBWay `W831004AS1P18`) are not reworked; the solderless v1.9 mitigations remain in [`temp-fix-v1.9.md`](temp-fix-v1.9.md). The schematic/PCB change lands with the spin; this section is the design authority until then.

### Inlet clamp at CN1 (#239)

**As built.** `+12V BAT` reaches CN1 (battery in), CN2 (field supply), D8 (field freewheel), C42 and U16 (field opto) directly. D14 (SS56) and F1 (2 A) sit between the inlet and `VIN_FUSED`, where D6 (SMBJ18A, 600 W) is the only TVS. A load dump or surge on the battery lug therefore reaches CN1/CN2/D8/U16 before any clamp.

**Decision.** Fit a load-dump-rated TVS across `+12V BAT` at CN1, and keep D6 on `VIN_FUSED` as the local clamp after D14/F1.

| Item | Choice |
| --- | --- |
| Inlet TVS | **MCC SM8S18CAHE3** (AEC-Q101, **bidirectional/CA**), DO-218AB, 6.6 kW class, 18 V standoff, 29.2 V clamp at 226 A. Liown `SM8S18CA` (LCSC C2990546) is the same 18 V / 29.2 V / 6.6 kW class. Bidirectional because CN1 is ahead of D14: a reverse battery must not forward-bias the clamp |
| Location | At CN1, across `+12V BAT` and GND, short wide path to the connector pin and the ground pour |
| Local clamp | D6 SMBJ18A stays on `VIN_FUSED` |
| Series device | None in the TVS branch. The vessel feeder fuse clears a failed-short TVS; the board fuse F1 is downstream and does not protect it |
| 24 V inlet | **Not allowed.** 18 V standoff is a 12 V-system part |

**Load-dump basis.** The fitted Leece-Neville ~320 A machine is externally regulated and has no internal rectifier or central suppression (INSTALLATION §6.2/§6.3.7). ISO 16750-2 Test A therefore applies: 12 V system, Us 79–101 V, Ri 0.5–4 Ω, td 40–400 ms, tr 10 ms. Test B (35 V, central suppression) is the fallback only if a suppressor is added at the alternator.

Worst case (Us = 101 V, Ri = 0.5 Ω, td = 400 ms), with the TVS clamping at 29.2 V:

```
I_TVS = (101 - 29.2) / 0.5 = 143.6 A
P_TVS = 29.2 x 143.6      = 4.19 kW
E_TVS = 4.19 kW x 0.4 s   = 1.68 kJ
```

The SM8S18CAHE3 is in the 6.6 kW DO-218AB load-dump family, 18 V standoff / 29.2 V clamp at 226 A. The MCC datasheet states the series meets ISO 7637-2 5a/5b and the ISO 16750 load-dump test, varied by test condition. The 6.6 kW / 226 A figures are **10/1000 µs peaks**: the worst-case Test A current at 29.2 V is 143.6 A (inside 226 A), but the 400 ms energy is the open check. The 1.68 kJ above is a rectangular upper bound; the standard's decaying waveform gives less, and either must be compared with the datasheet's pulse-width derating curve (Fig. 1), not with the 10/1000 µs peak. If that check does not close, a board-level TVS is not sufficient for an unsuppressed alternator: the installation must fit a central suppressor at the alternator (Test B) or guarantee field de-excite before the battery disconnects. At Ri = 4 Ω the 10/1000 µs pulse is 17.8 A / 520 W. Test B (35 V): 11.6 A / 339 W.

**Downstream absolute maxima at 29.2 V.** The clamp is only useful if nothing behind it is over its limit:

| Part | Net | Limit | 29.2 V |
| --- | --- | --- | --- |
| TPS5430 (U3) | `VIN_FUSED` → `VIN_BUCK` | 40 V abs max | OK |
| LMBR340 catch diode | `SW_5V` | 40 V | OK |
| SS56 (D14, cathode `VIN_RP`) | `VIN_RP` / `+12V BAT` | 60 V | OK; also blocks a reverse battery from the protected side |
| VS-43CTQ100S (D8) | `+12V BAT` / `PWM_DRIVE` | 100 V | OK |
| PC817 (U16, U17) | `+12V BAT` / `+12V` | 35 V VCEO | OK |
| INA226 (U18, U19) | `+12V` | 36 V VBUS | OK |
| C19, C42 | `VIN_FUSED` / `+12V BAT` | 50 V | OK |
| BUK762R4-60E (Q4) | `PWM_DRIVE` | 60 V | OK |
| **S8050 (Q2, Q3)** | `+12V` / buzzer | **25 V VCEO** | **FAIL** |
| **MCP1407 (U23)** | `+12V` | **20 V abs max** | **FAIL** |

The two failures are part of this change, not a follow-up: the inlet TVS is only released with them.

- Replace Q2/Q3 with a 40 V+ NPN (e.g. MMBT5551, 160 V, SOT-23) and U23 with a 35 V+ gate driver (e.g. IXDN609, 4.5–35 V).
- If the owner rejects the driver change, the fallback is a local clamp/regulator on the `+12V` feed to U23 and the relay driver that holds both below their limits; that fallback is not preferred.

With the replacements the 29.2 V clamp has margin to every part on the rail. Until the spin, do not run a v1.9 board into a load dump; the inlet TVS temp fix in `temp-fix-v1.9.md` limits the exposure but does not change the U23/Q2 ratings.

**Machine data still open.** The fitted machine's own datasheet (Us, Ri, duration) is not in this repo, and the installation only fixes the topology: external field regulator, no internal rectifier or central suppression. ISO 16750-2 Test A (79–101 V, 0.5–4 Ω, 40–400 ms) is therefore the bounding class, not a machine-specific measurement. The acceptance box *Calculation against the fitted alternator's Us, Ri and duration* stays open until the owner supplies that datasheet or a bench capture.

**Reverse battery.** CN1 is ahead of D14, so a reversed battery puts −12 V on CN2, D8, C42 and U16. The bidirectional clamp does not conduct there (18 V standoff), and D14 protects the rest. U16's phototransistor is the exposed part; #238 moves its collector to protected `+12V`, which closes this. Do not fit the inlet TVS without that move.

**Status.** This is a design record for the next spin. The issue stays open until the schematic/PCB carries the clamp, the U23/Q2 replacements and the U16 move.

**Sustained overvoltage (12 V board only).** The TVS is a pulse clamp, not a regulator. A stuck charger, a 24 V battery, or any sustained voltage above the 18 V standoff holds the TVS in breakdown and destroys it. v1.9 has no overvoltage disconnect. The only protection is the vessel feeder fuse, the ENBL/BMS charge-permit interlock, and the rule that this board is 12 V only. A sustained-overvoltage disconnect is a separate next-spin decision; do not fit this board on a 24 V system.

### Field fail-off enable (#238)

**As built.** GPIO38 → R29 1 kΩ → U16 PC817 LED. U16's phototransistor has its collector on raw `+12V BAT` and its emitter on the U23 MCP1407 input (R32 10 kΩ to GND, R50 120 Ω series). U23 drives Q4's gate; R40 10 kΩ holds the gate low. A shorted U16 output therefore pulls the driver input high and turns Q4 on with no GPIO involvement. U16's collector is also ahead of F1.

**Decision.** Add three independent layers and keep the hard ceilings untouched:

| Layer | Part / change | What it does |
| --- | --- | --- |
| Run/allow AND | 74LVC1G08 (3.3 V) combining U14 `ENBL_GPIO` and the watchdog `RESET` | ENBL false always removes the field enable, in hardware |
| Watchdog enable | TI TPS3813K33-Q1 window watchdog + BSS84 P-FET (Q5) in the `+12V` feed to U23 pins 1/8 | No valid heartbeat → U23 unpowered → R40 holds Q4 off |
| Gate monitor | `PWM_GATE` → 100 kΩ / 22 kΩ divider → spare GPIO (GPIO21) | Firmware compares gate to command; a mismatch stops the heartbeat |

Supporting changes: U16 collector moves from `+12V BAT` to protected `+12V`; add a **12 V zener** (BZX84C12) gate-source clamp on Q4 and on Q5, with a 100 Ω series gate resistor on Q5 — a 15 V TVS clamps too high for the ±20 V Vgs limit; add a 100 kΩ pull-up on the TPS3813 open-drain RESET, a 100 kΩ pull-down on WDI (so a dead ESP reads no heartbeat), and a 100 kΩ pull-down on the Q6 gate. The enable is off at power-up and during reset: Q5's gate is pulled to its source by 100 kΩ (Vgs = 0, off), Q6's gate is pulled down by 100 kΩ (off), and the TPS3813 RESET is low from VDD = 1.1 V until VDD crosses VIT and the 25 ms delay elapses (SPRS288H §7.3), so the 74LVC1G08 output is low and Q6 stays off. Q5 therefore has no gate drive and U23 is unpowered.

**Failure modes.**

| Fault | Path | Field | How it ends off |
| --- | --- | --- | --- |
| U16 output shorted | Driver input high with no command | **Off on the next off command or any hard trip** | Gate monitor sees gate high while the PWM command is low → firmware stops the heartbeat → TPS3813 RESET low → Q5 off |
| U16 output open | R32 pulls driver input low | **Off** | Direct |
| GPIO38 stuck high | Command high; gate follows | **Off on the next off command or any hard trip** | Gate monitor sees the gate stay high when the firmware commands off → heartbeat stops → Q5 off |
| ESP dead / hung | No WDI edges | **Off** | TPS3813 times out (WDT = GND: 0.25 s) → RESET low → Q5 off |
| ENBL false | U14 output low | **Off** | 74LVC1G08 output low → Q6 off → Q5 off |
| U23 output shorted high | Gate high with no command | **Off on the next off command or any hard trip** | Same gate-monitor path as a shorted U16 |
| Q4 drain-source shorted | Field on independent of the gate | **On** | **Residual:** needs a series field disconnect or a field-current monitor; F3 protects the wiring, not the alternator. Keep the field wire off until this is designed |

**Firmware.** The next-spin firmware drives WDI at 20–50 ms. With WDT = WDR = GND the TPS3813-Q1 gives a 0.25 s timeout (0.2–0.3 s) and a 1:31.8 window ratio, so the lower edge is 0.25 / 31.8 ≈ 7.9 ms and the upper edge is 250 ms (datasheet SPRS288H §6.7: WDT = 0 V → 0.2/0.25/0.3 s; WDR = 0 V, WDT = 0 V → 1:31.8). 20–50 ms is inside that window. The firmware reads the gate-monitor GPIO (PWM_GATE through 100 kΩ/22 kΩ + 1 µF, giving the average duty) and stops the heartbeat on a command/gate mismatch or any hard trip. `on_boot` keeps the heartbeat off until the control loop is healthy. Hard ceilings (`ALT_I_CEIL`, `HOUSE_V_CEIL`, `ALT_T_CEIL`) are unchanged. The v1.9 production board has no Q5, no watchdog and no gate-monitor divider, so this firmware change lands with the spin, not before. The #239 U23 replacement (IXDN609) is compatible: Q5 switches the driver supply and the gate monitor stays on `PWM_GATE`.

### 4–20 mA loop protection (#237)

**As built.** `+12V` → U5/U6 pin 1 → sensor → `LVL1`/`LVL2` → R35/R36 10 Ω → R38/R39 3.9 Ω shunt → GND. There is no series fuse, no reverse blocking and no TVS at the connector. A loop short leaves 13.9 Ω and draws 0.86 A; a shunt short leaves 10 Ω and draws 1.2 A. R35/R36 dissipate 7.4 W and R38/R39 2.9 W in 0805 bodies; F1 (2 A) never clears. D18/D19 (ESD5Z3.3) conduct on the shunt node under that fault.

**Decision.** Add the same protection to each loop:

| Item | Part | Rating / effect |
| --- | --- | --- |
| Series PPTC between `+12V` and U5/U6 pin 1 | Littelfuse **1206L010/60WR** | 0.10 A hold, 0.25 A trip, 60 V; 0.86 A fault trips it; ≈1.5–6 Ω initial, so ≈0.03–0.12 V at 20 mA |
| Reverse-blocking diode in the return, **anode at `LVL1`/`LVL2`, cathode toward R35/R36** | **SS14** (already in the BOM) | 40 V, 1 A; ≈0.25 V at 20 mA. A reverse-wired loop reverse-biases it: the loop is open, no current, no board damage; the sensor itself sees reverse polarity, so label the loop |
| Connector TVS | **SMBJ15A** at `LVL1`/`LVL2` to GND | 15 V standoff (off at 12 V), 24.4 V clamp; inside the INA226 36 V input |
| Existing ESD | D18/D19 stay | Clamp the shunt node after R35/R36 |

**Normal operation.** At 20 mA the added drop is ≈0.28–0.37 V (PPTC + diode); adding the existing 0.278 V in R35/R36 + R38/R39 gives ≈0.56–0.65 V total, so the sensor sees ≈11.35–11.44 V at a 12 V feed. The shunt still sees 78 mV (inside ±81.92 mV) and the INA226 calibration is unchanged: the PPTC and diode are outside the shunt. Check the sensor's minimum operating voltage before release; the SW-LT100 data sheet gives 12 V nominal with no tolerance, so a sensor that needs 12 V minimum needs a lower-drop feed (P-MOSFET current limit) instead of the PPTC.

**Fault.** A short or reverse loop draws 0.86 A. The 1206L010 holds 0.10 A and trips at 0.25 A, so 0.86 A is over trip — but the **time to trip at 0.86 A is not specified in this record**. Read the datasheet's time-to-trip curve and gate the design on the 1-minute short/reverse test; until that test, R35's 7.4 W pulse energy is unverified. If the trip is too slow, use the 50 mA-hold `1206L005/60WR` or a current-limited feed. The short/reverse 1-minute test and the production rebuild/DRC stay open until the next spin and a board in hand.

### TPS5430 battery UVLO and ENA test point (#240)

**As built.** U3 ENA (pin 5) floats. The buck starts at the chip's own UVLO — 5.3 V typical, 5.5 V maximum — with no defined battery threshold, and there is no ENA test point.

**Decision.** Add a divider from `VIN_FUSED` to ENA and a test point:

| Item | Choice |
| --- | --- |
| Divider | **R56 61.9 kΩ 1%** from `VIN_FUSED`, **R57 10 kΩ 1%** to GND, ENA at the junction |
| Test point | **TP7** on ENA |
| ENA pull-up | Internal 5 µA current source (SLVS632K functional diagram); the divider Thevenin is 8.6 kΩ, so the pull-up shifts the threshold by only 0.043 V |

**Thresholds.** The ENA rising threshold is 1.3 V maximum and the falling threshold is 0.5 V minimum (SLVS632K §6.5).

```
VIN start (1.3 V max)             = (1.3 - 0.043) / 0.1391 = 9.0 V
VIN stop  (325 mV typ hysteresis) = (1.3 - 0.325 - 0.043) / 0.1391 = 6.7 V
```

The ENA divider starts the buck at **at most 9.0 V** (the datasheet gives only the 1.3 V maximum rising threshold; the typical start is lower, so record it on the bench) and stops it at about **6.7 V** typical. The guaranteed floor is lower: the ENA falling threshold is specified only as ≥0.5 V, and the TPS5430 internal UVLO stops at 5.3 V typical / 5.5 V maximum. A true 9 V stop needs a voltage supervisor/comparator with hysteresis; that is not part of this change and should be a separate decision if the owner wants it.

**Clamp tolerance.** At the 29.2 V inlet clamp, ENA = 29.2 × 10 / 71.9 + 0.043 = **4.10 V**, below the 7 V absolute maximum. Divider current is 0.41 mA and R56 dissipates 10 mW at that point; at 12 V it is 0.17 mA and 1.7 mW.

**Bench.** The start threshold is dominated by the ENA threshold, for which the datasheet gives only a maximum. Sweep `VIN` and record the actual start and the 5 V rail; that measurement is the acceptance gate. The hard ceilings are unchanged — this is a 5 V-buck UVLO, not an alternator limit.

## Known limitations

- USB-C does **not** power 12 V loads (relay, PWM output stage, loop supply)
- CAN termination (**JP1**) only at backbone ends
- All ESP32 GPIOs are **3.3 V**
- Shunt sense is mV-level — twisted Kelvin pair required
- CN4 3.3 V share is limited by the SY8089 budget (ESP + CAN + INA + display); CN4 5 V shares F2 (1 A) with the status LED
- **CN4 has zero hardware protection** (no series R / ESD clamp / pull) — internal short cable only
- GPIO3 is unconnected on this spin; if a future revision routes it, it has no internal pull (ESP32-S3-WROOM-2 datasheet §4.4) and is the JTAG-source strap — add an external ~10 kΩ pull
- Keep `Documentation/*.png` exports in sync after schematic edits (agents and humans both use them)
- v1.9 board faults, solderless temp fixes, and risks: [temp-fix-v1.9.md](temp-fix-v1.9.md)

---

## Schematic symbols

KiCad 10. Draw a new symbol with the skills in [kicad-skills/README.md](kicad-skills/README.md). Search the libraries on disk, write the datasheet pinout to a JSON pin table, and let `kicad-skills/scripts/kicad_sym.py` write the symbol. `kicad-cli` exports an SVG and runs ERC. That script is the only writer of symbol text.

| What | Nickname | Path |
| --- | --- | --- |
| Official symbols | the file name, such as `Device` or `Sensor_Energy` | KiCad `SharedSupport/symbols` |
| LCSC import | `LCSC` | `Lib/EasyEDA.kicad_sym`, footprints in `Lib/EasyEDA.pretty` |
| Espressif footprints | `PCM_Espressif` | `Lib/footprints/com_github_espressif_kicad-libraries/Espressif.pretty` |
| Symbols drawn for these boards | `Sisu` | `Lib/Sisu.kicad_sym` |

`MarineBoard/sym-lib-table` nicknames that file `Sisu`. The URI is `${KIPRJMOD}/Lib/Sisu.kicad_sym`. The library starts empty. A nested project, such as the fridge daughter board, needs its own row with URI `${KIPRJMOD}/../Lib/Sisu.kicad_sym`. Add a library-table row with KiCad closed. A `~` lock file next to a project file means KiCad has that project open.

A resistor, capacitor, inductor, diode, or LED stays `Device:R`, `Device:C`, `Device:L`, `Device:D`, or `Device:LED`. The Value field holds `10k` or `100n`.

`fab_package.py` reads the properties `MPN` and `Manufacturer`. The LCSC importer writes order-code fields on an EasyEDA symbol. Check the pins with `show` and `match` before placing that part. The importer spec is [LCSC Importer Technical Spec.md](LCSC%20Importer%20Technical%20Spec.md).

The script refuses the production schematic and board, `v1.00/`, quilter copies, and `EasyEDA.kicad_sym`. The quilter copies are a KiCad 8 upload set. Saving one in KiCad 10 upgrades the file, and the upload then rejects it.

---

## ERC gate

`./scripts/verify.sh` runs `kicad-cli sch erc` whenever `MarineBoard/*.kicad_sch` is in the change set. Any error fails the check. Every warning tag and its count must equal the `ERC_EXPECT` baseline in `scripts/verify.sh`; a new tag or a count change fails. A machine without `kicad-cli` skips the check and says so; the Mac run is the gate, and CI does not install KiCad.

The remaining warnings are triaged per tag, not suppressed:

- **88 `lib_symbol_issues`** — legacy imported symbols carry an empty library nickname (`""`), so ERC cannot resolve them to a library. It is a housekeeping warning, not an electrical one. Re-home the symbol when it is redrawn.
- **4 `lib_symbol_mismatch`** — deliberate local fixes to cached symbols: the WS2812 DIN pin type, and three `power:+5V` instance values set to `+5V_VCC`. Do not sync these back to the libraries.
- **137 `pin_to_pin`** — connections through `Unspecified` pins on LCSC/EasyEDA symbols. The imported pin types are not modelled, so ERC cannot judge drive strength. Fix the pin types symbol by symbol and lower `ERC_EXPECT` in `scripts/verify.sh`; do not raise it without a written reason.

`PWR_FLAG` on GND drives the ground net for ERC. It is schematic-only and adds no copper.

---

## Footprint placement

The skills in [kicad-skills/README.md](kicad-skills/README.md) move a footprint that is already on the board. The table gives the reference, x, y, rotation, and side. x and y are the millimetres the PCB editor shows. Tracks, vias, and zones stay as they are. Quilter routes the copper. `fab_package.py` checks the finished board. The script refuses the production board, `v1.00/`, and quilter copies.

---

## Resources

- Schematic: `MarineBoard.kicad_sch`
- Pin sheet: `Documentation/ESP32.png`
- Connector pin numbers: this document + `Documentation/HEADER PINS.png`
- Subcircuits: `Documentation/CAN INTERFACE.png`, `PWM DRIVERS.png`, `IO PROTECTION.png`, `LEVELS MONITOR.png`, etc.
- Schematic symbols and footprint placement: the sections above, and [kicad-skills/README.md](kicad-skills/README.md)
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
| 1.9 | Oct 2026 | **Pre-fab corrections (#183), before the first PCBWay order (W831004AS1P18); silk still reads v1.9.** U3 ENA floating (was tied to VIN, over its 7 V abs max). U2 INA226 VBUS tied to Vin+ (high-side shunt; was floating behind series C10, C10 removed). Cap ratings by MPN: C11/C12/C14/C19/C42 → `CL05B104KB5NNNC` 50 V, C33 → 1 µF 50 V. C20 → Panasonic `10SVPE220M` 20 mΩ polymer; buck add-on network C21/C22/R13/C23 removed. U23 MCP1407 VDD (pins 1+8) + C33 moved from raw `+12V BAT` to protected `+12V`. D5 VDD fed through **D21** 1N4148W (≈4.35 V, so 3.3 V data meets VIH). **D17** SS14 flyback across BUZZER1. **CAN moved to GPIO5 TX / GPIO6 RX** (off UART0 GPIO43/44). Test pads **TP1–TP6**: GND, +12V, +5V_VCC, +3.3V, PWM_GATE, VSENSE. C15 stays 25 V (accepted: 50 V 1206 would lose input-filter damping). Vias resin-filled + capped |
| 1.9 | Oct 2026 | **Enclosure** (#194): printed PA12 box 129.4 × 107.9 × 44 mm, IP67 panel connectors (EW-LP20, M12-5, 12G), silicone-cord seal, D5 light pipe — see *Enclosure*. BOM part numbers for generic parts (L7/L9/L10 BLM21PG331SN1D, D16 KT-0603R, U23 MCP1407-E/MF) ahead of the 5-unit assembly order (`Documentation/MarineBoard-BOM-5units-2026-10-09.xls`); no copper change, silk still v1.9 |
| 1.9 | Oct 2026 | **PCBWay T-1P19W831004A replies (#199).** No copper change. Descriptions corrected: R5/R6 are 1%, R47 is 2 W, D5 is WS2812B-2020-V6, D21 is diode 1N4148W-7-F, D2/D3 package name is DFN1006-2L. Fuses and the JP1 shunt are fitted, not supplied loose. F2 is Eaton Bussmann ATM-1 because Littelfuse 0297001.WXNV does not exist. |
| 1.9 | Oct 2026 | **One fuse brand (#200).** F1 ATM-2, F2 ATM-1, F3 and F4 ATM-10, all Eaton Bussmann. Ratings stay 2 A, 1 A, and 10 A. Littelfuse MINI has no 1 A part. No copper change. |
| 1.9 | Oct 2026 | **v1.00 prototype recorded (#216).** The first build (PCBWay delivery 2026-08-15) is aboard as the freezer controller; files in `v1.00/`. New section *v1.00 prototype (aboard)* lists its errata against v1.9 and the C10 bridge rework for INA226 bus voltage. No copper change. |
| 1.9 | Oct 2026 | **v1.00 prototype retired (#218).** U3 burnt 2026-10-20 during freezer bring-up, matching the EN-over-abs-max erratum (root cause not confirmed). No Marine Board aboard until the v1.9 boards arrive. No copper change. |
| 1.9 | Nov 2026 | KiCad agent skills for new schematic symbols: [kicad-skills/README.md](kicad-skills/README.md). No copper change. |
| 1.9 | Nov 2026 | Schematic symbol rules in this spec: library nicknames, `Lib/Sisu.kicad_sym`, and the LCSC importer pin check (#232). No copper change. |
| 1.9 | Nov 2026 | `sym-lib-table` names `Lib/Sisu.kicad_sym` as `Sisu` (#233). The library file is empty. No copper change. |
| 1.9 | Nov 2026 | Footprint placement skills (#234). A table moves a footprint that is already on the board. Quilter still routes the copper. No copper change. |
| 1.9 | Nov 2026 | **v1.9 design and fab package archived in [`v1.9/`](v1.9/)**: KiCad project, `production/` (gerbers, BOM, positions, 5-unit and enclosure order BOMs), `PCBWay/` order files, `Schematics/` renders, and `enclosure/`. The v1.00 PCBWay delivery moved to `v1.00/`; `MarineBoard.csv` and `sch_data.json` removed as stale. Board silk (LOGO1 value) and schematic title text set to **v1.9**. No copper change. |
| 1.10 | Nov 2026 | **Version reset to v1.10.** The current design has no board in production; the five v1.9 boards, PCBWay order, root `production/` and `v1.9/` archive stay at **v1.9**. No copper, BOM or production-gerber change in this row; v1.9→v1.10 differences are a separate change. |
| Next | — | **Next-spin decision (#239):** inlet load-dump TVS `SM8S18CAHE3` at CN1, with the U23/Q2 derating that the 29.2 V clamp forces. Not fitted on v1.9; no copper change. |
| Next | — | **Next-spin decision (#238):** watchdog + ENBL hardware enable on the U23 supply, gate monitor, U16 collector moved to +12 V; failure table recorded. Not fitted on v1.9; no copper change. |
| Next | — | **Next-spin decision (#237):** 100 mA PPTC + series Schottky + SMBJ15A on each 4–20 mA loop. Not fitted on v1.9; no copper change. |
| Next | — | **Next-spin decision (#240):** TPS5430 ENA divider 61.9 kΩ / 10 kΩ for a ~9 V start, TP7 on ENA. Not fitted on v1.9; no copper change. |

---

Available GPIO pool (revised; GPIOs not marked "Used" are unrouted on this spin — pads only)

Pin GPIO Alt-functions Status
15 GPIO3 TOUCH3, ADC1_CH2 Available (strapping — JTAG source; fine to use as long as nothing holds it during reset)
5 GPIO5 TOUCH5, ADC1_CH4 Used — CAN TX (1.9)
6 GPIO6 TOUCH6, ADC1_CH5 Used — CAN RX (1.9)
37 GPIO43 U0TXD Available with caveat — ROM/bootloader log toggles it at every reset
36 GPIO44 U0RXD Available with caveat — UART0 RX for ROM download
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
