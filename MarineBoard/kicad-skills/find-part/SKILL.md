---
name: find-part
description: Search KiCad symbol and footprint libraries before drawing a new Sisu part. Use when a schematic needs a component, including passives, connectors, and ICs.
---

# Find a KiCad part

Use this before [create-symbol](../create-symbol/SKILL.md). A part that already has a symbol should keep that symbol.

Library nicknames, the files the script will not write, and the KiCad binary are in the [folder README](../README.md).

## Search order

1. Official KiCad symbols, under the app's `SharedSupport/symbols`.
2. `MarineBoard/Lib/EasyEDA.kicad_sym`. The project table nicknames this library `LCSC`.
3. `MarineBoard/Lib/symbols/com_github_espressif_kicad-libraries/Espressif.kicad_sym`. The file is on disk. `MarineBoard/sym-lib-table` does not list it, and `find` says so.
4. `MarineBoard/Lib/Sisu.kicad_sym`, once a symbol has been built there.

A resistor, capacitor, inductor, diode, or LED stays a generic symbol: `Device:R`, `Device:C`, `Device:L`, `Device:D`, `Device:LED`. The Value field carries `10k` or `100n`. One symbol per value turns the library into a copy of the BOM.

Power nets that already exist are `power:GND`, `power:+12V`, `power:+5V`, `power:+3V3`, and `power:PWR_FLAG`. A new rail is a power symbol from create-symbol.

## Commands

```bash
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py find INA226
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py show Sensor_Energy:INA226
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py find SOT-23 --footprints
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py pads Package_TO_SOT_SMD:SOT-23
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py match Sensor_Energy:INA226 LCSC:VSSOP-10_3x3mm_P0.5mm
```

`show` prints pin numbers, names, and electrical types. Compare that list to the datasheet before placing the part. An imported LCSC symbol can carry the right order code and the wrong pinout. The pin list is the check.

`show` and `match` follow a same-library `(extends "Parent")` chain. `Transistor_BJT:2N3904` lists pins 1, 2, and 3 from `Q_NPN_EBC`. A pin number written on the child replaces that parent pin.

`match` exits 1 when a symbol pin has no pad with that number. Extra numbered pads are printed and still exit 0. Read that line. The official `Package_SO:HVSSOP-10-1EP_3x3mm_P0.5mm_EP1.83x1.89mm` has pin numbers 1-10 plus pad 11, the exposed pad. `match` exits 0 against `Sensor_Energy:INA226`. The INA226 package has no exposed pad, so U2 on this board stays `LCSC:VSSOP-10_3x3mm_P0.5mm`.

## Footprint field

The Footprint property is `Library:Name`. Official footprints live in `SharedSupport/footprints`. Project footprints in `Lib/EasyEDA.pretty` use the nickname `LCSC`. The vendored Espressif footprints use `PCM_Espressif`.

Leave the field empty until `find --footprints` and `pads` agree with the symbol pin numbers.
