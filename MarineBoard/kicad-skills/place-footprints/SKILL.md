---
name: place-footprints
description: Move footprints that are already on a KiCad board from a placement table. Use when a footprint's x, y, rotation, or side should change, and the board is one this script is allowed to write.
---

# Place footprints

The footprints are already on the board. `kicad_pcb.py` does not add one, and it does not draw a track. Quilter routes the copper. DRC stays in [verify-schematic](../verify-schematic/SKILL.md).

The table is JSON. Units are millimetres. `x` and `y` are the numbers the PCB editor shows. `rot` is degrees. `side` is `front` or `back`. An example that is not applied to a board is [examples/two-parts.json](examples/two-parts.json).

`kicad-cli pcb export pos` prints the opposite sign for Y. A part at y 69.25 is exported as PosY -69.25. Write 69.25 in the table. `check` compares the board-file coordinate to that export. Do not copy PosY into the table.

Changing side calls KiCad's `Flip` on that footprint after the board is loaded, then sets the rotation from the table. `Flip` before the footprint is on the board crashes KiCad's Python. The footprint mirrors in Y and the front and back layers swap. Each pad keeps its shape with the body. Text rotates with the body. Text that would be upside down turns a further 180 degrees so it stays readable, unless that text is unlocked. Tracks stay where they were, so DRC can report an unconnected track after a move.

```bash
python3 MarineBoard/kicad-skills/scripts/kicad_pcb.py apply path/to/board.kicad_pcb path/to/table.json
python3 MarineBoard/kicad-skills/scripts/kicad_pcb.py check path/to/board.kicad_pcb path/to/table.json
```

`apply` exits 2 on the production board, `v1.00/`, a quilter copy, an EasyEDA file, or a `~` lock. It exits 1 when a reference is missing, duplicated, or locked. Close KiCad first. The files this script refuses are listed in the [folder README](../README.md).
