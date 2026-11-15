---
name: create-symbol
description: Draw a new KiCad 10 schematic symbol for a Sisu board from a datasheet pin table. Use when find-part has no symbol whose pins match the datasheet.
---

# Create a KiCad schematic symbol

Run [find-part](../find-part/SKILL.md) first. Library nicknames and the files this script will not write are in the [folder README](../README.md).

## Pin table

Write one JSON file. One object per datasheet pin, in the order to draw them. Left and right run top to bottom. Top and bottom run left to right.

```json
{
  "name": "PC817",
  "reference": "U",
  "value": "PC817",
  "description": "Optocoupler, single channel",
  "datasheet": "https://example/pc817.pdf",
  "footprint": "",
  "mpn": "PC817X",
  "manufacturer": "Sharp",
  "pins": [
    {"number": "1", "name": "A", "side": "left", "type": "passive"},
    {"number": "2", "name": "K", "side": "left", "type": "passive"},
    {"number": "3", "name": "E", "side": "right", "type": "passive"},
    {"number": "4", "name": "C", "side": "right", "type": "passive"}
  ]
}
```

`type` is one of `passive`, `input`, `output`, `bidirectional`, `tri_state`, `power_in`, `power_out`, `open_collector`, `open_emitter`, `no_connect`.

Positive supply pins use `"side": "top"`. Ground and negative supply use `"side": "bottom"`. Inputs and enables go on the left. Outputs go on the right. Group a bus (SPI, UART, I2C) as the datasheet names it. That grouping is KiCad library convention [S4.2](https://klc.kicad.org/symbol/s4/s4.2.html). The script places the pins. It does not choose the grouping.

An active-low pin sets `"active_low": true`. `name` is the text under the bar. The script writes `~{RESET}`, which draws a bar over RESET. It does not also set the inverted pin shape. A lowercase `n` prefix is removed, so `nRESET` becomes `~{RESET}`. `NSS`, `NMI`, and `NC` keep the N, because that letter is part of the name.

`mpn` and `manufacturer` are the property names the fab export reads. Leave `footprint` empty until find-part's `match` agrees.

Every datasheet pin is in the table. A pin the datasheet says to leave open uses `no_connect` and stays visible, so the schematic has to mark it.

`examples/selftest-opto.json` is the shape the selftest builds. It is not a part. Copy it as a starting file and replace the pins from the datasheet.

## Build

```bash
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py build path/to/pins.json
```

The script writes `MarineBoard/Lib/Sisu.kicad_sym` and replaces a symbol of the same `name` on the next run. If `Sisu` is missing from `MarineBoard/sym-lib-table`, the script prints the row to add. Add it with KiCad closed. A nested project uses a different path in that row. The folder README has that path.

Then:

```bash
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py check MarineBoard/Lib/Sisu.kicad_sym PC817
```

`check` exports an SVG and runs ERC on a throwaway sheet that contains only this symbol. Open the SVG and read the pin names. Unconnected-pin reports on that throwaway sheet mean the pins loaded.

## Power nets

A rail that is not already in the `power` library is a pin table with `"kind": "power"` and `"name"` set to the net, for example `+12V_FILT`. The name is the global net. The script draws the upward arrow used by `power:+12V`. Ground stays `power:GND`.

## What the script does not draw

One unit, one pin per number. Multi-unit symbols, KiCad 10 pin stacks, and alternate pin functions are later edits in the symbol editor, after `check` passes. Two pads that share a net are two pins with the same name until someone stacks them in the editor.

## Place it on a sheet

```bash
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py place MarineBoard/Lib/Sisu.kicad_sym PC817 --sch path/to/sheet.kicad_sch --at 127,80
```

`--at` is the symbol origin in millimetres, on a 1.27 mm grid. `place` inserts the symbol and its pins. It draws no wires. It refuses the production Marine Board sheet, `v1.00/`, and quilter copies, and it exits 2 when a `~` lock file sits next to the sheet.

The fridge daughter schematic stays empty until the owner accepts `MarineBoard/daughter-fridge/technical spec.md`.

## Geometry the script locks

Pin connection points are on a 2.54 mm grid. Pin length is 2.54 mm. That is library convention [S4.1](https://klc.kicad.org/symbol/s4/s4.1.html). An even number of pins on one side sits one grid step off center, so the pins stay on that grid.
