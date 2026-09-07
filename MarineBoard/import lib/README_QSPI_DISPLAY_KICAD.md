# SailingSisu 4.0" QSPI display — KiCad symbol + footprint

## Files
- `SailingSisu_Display.kicad_sym` — schematic symbol `DISP_QSPI_4IN_18P`
- `FH12-18S-0.5SH_QSPI4IN.kicad_mod` — Hirose FH12-18S-0.5SH(55) land pattern

## Install
1. Preferences → Manage Symbol Libraries → add `SailingSisu_Display.kicad_sym` (project or global).
2. Create a pretty folder e.g. `SailingSisu_Display.pretty` and put the `.kicad_mod` in it.
3. Preferences → Manage Footprint Libraries → add that pretty folder as nickname `SailingSisu_Display`.
4. Place `DISP_QSPI_4IN_18P`. Footprint field is already set.

Official KiCad footprint (same pads) if you prefer the stock 3D:
`Connector_FFC-FPC:Hirose_FH12-18S-0.5SH_1x18-1MP_P0.50mm_Horizontal`

## Pin map (matches marine board nets)

| Pin | Net on symbol | GPIO on Sisu board | Function |
|-----|---------------|--------------------|----------|
| 1 | GND | — | GND |
| 2 | VCI | +3V3 | Panel 3.3 V |
| 3 | FSPIRST | GPIO17 | LCD reset |
| 4 | FSPICS0 | GPIO10 | CS |
| 5 | FSPICLK | GPIO12 | SCK |
| 6 | FSPID | GPIO11 | QSPI D0 |
| 7 | FSPIQ | GPIO13 | QSPI D1 |
| 8 | FSPIHD | GPIO9 | QSPI D2 |
| 9 | FSPIWP | GPIO14 | QSPI D3 |
| 10 | FSPIDC | GPIO21 | DC |
| 11 | FSPITE | GPIO42 | TE |
| 12 | FSPIBL | GPIO18 | Backlight (via FET, not raw LED) |
| 13 | FSPITI | GPIO47 | Touch INT |
| 14 | SDA | GPIO40 | Touch SDA |
| 15 | SCL | GPIO41 | Touch SCL |
| 16 | TP_RST | GPIO3 (or GPIO5) | Touch reset |
| 17 | TP_VDD | +3V3 | Touch 3.3 V |
| 18 | GND | — | GND |

FSPICS1 / GPIO39 stays off this connector.

## Hardware notes
- Connector: Hirose **FH12-18S-0.5SH(55)** bottom contact, 0.5 mm, 18 pos.
- FPC: 0.30 mm thick, gold on the **bottom** (contacts face PCB).
- Cable out the actuator side (positive Y on the footprint).
- MP pads must be soldered; they take peel force.
- Decouple VCI at the connector: 100 nF + 10 µF.
- GPIO18 → N-FET / LED driver. Do not wire LEDA/LEDK straight to 3.3 V GPIO.
- Series 22–33 Ω on CLK and D0–D3 if the FFC is longer than ~80 mm.

## Panel to buy
4.0" 480×480 **QSPI** IPS + CTP. Reject 40-pin “SPI+RGB / ST7701” ribbons — those will not match this pinout.
