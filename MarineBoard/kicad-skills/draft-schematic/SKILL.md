---
name: draft-schematic
description: Draw the first draft of a new Sisu board's KiCad 10 schematic from a net table, with ERC, a pin-by-pin netlist check and a PDF. Use when a board has an approved spec and an empty .kicad_sch, before anyone draws by hand.
---

# Draft a schematic from a net table

KiCad 10 cannot place symbols from a script, and the schematic editor has no API. So the first draft is written as text: a net table in Python, and [`draft_sch.py`](../scripts/draft_sch.py) turns it into a `.kicad_sch` and checks the result. The binary, library nicknames and lock-file rules are in the [folder README](../README.md).

This is for the **first draft only**. The script overwrites the whole sheet. Once the owner edits the schematic by hand, the `.kicad_sch` is the source and the table is deleted.

## 1. Parts first

Every part needs a real `Lib:Symbol` id before it goes in the table. Use [find-part](../find-part/SKILL.md). The script reads KiCad's bundled libraries and the nicknames in the project's own `sym-lib-table` (`LCSC`, `Sisu`). A part that exists nowhere goes through [create-symbol](../create-symbol/SKILL.md) into `Sisu` first.

Get the pin numbers from the symbol, not from memory. This prints every pin with its number, name and position:

```bash
python3 -I -c "import sys; sys.path.insert(0,'MarineBoard/kicad-skills/scripts'); import kicad_libpins as L; L.use_project('MarineBoard/<board>'); print(L.pins('Isolator','PC817'))"
```

Then check those numbers against the datasheet. A symbol from another library can number the same package differently: the bundled `Isolator:PC817` and the imported `LCSC:PC817C-S` agree on pins 1 to 4, but nothing guarantees that for every part.

## 2. Write the table

Copy the shape of [`daughter-fridge/draft_nets.py`](../../daughter-fridge/draft_nets.py). It defines:

- `PARTS`: `(ref, "Lib:Symbol", value, footprint, (x, y), {pin: net})`. Every pin of the symbol must appear. `None` puts a no-connect flag on it. A ref starting with `#` is a power flag. References need a number (`R16`, not `RD`), or the netlist export reports annotation errors.
- `NOTES`: `((x, y), "text")`, one per block. Keep lines under about 45 characters, or they run into the next block.
- `PAPER`, `TITLE`.

Net names follow the spec and the project's net-class patterns in `.kicad_pro`. Put a `PWR_FLAG` on every rail that only reaches the sheet through a connector, or ERC reports `power_pin_not_driven`.

Lay out by block in columns, positions on the 2.54 mm grid. Give vertical stacks of two-pin parts at least 25 mm, so the labels above and below don't meet.

## 3. Build and check

```bash
python3 -I MarineBoard/kicad-skills/scripts/draft_sch.py MarineBoard/<board>/<board>.kicad_pro MarineBoard/<board>/draft_nets.py
```

Exit 0 means all of these passed:

| Step | Fails on |
|---|---|
| Build | A table pin the symbol lacks, a symbol pin the table forgot |
| `kicad-cli sch erc` | Any violation, warnings included. A footprint library that doesn't resolve shows up here |
| Netlist vs table | A pin on the wrong net, a pin the table doesn't list, a net with one pin |
| PDF | Written to `<board>/docs/<board>-schematic.pdf` |

What the netlist check proves: the drawing says what the table says. It cannot prove the table is right. Both come from the same file, so a wrong net in the table passes. The design itself is checked by a person reading the PDF against the spec.

## 4. Look at it

Open the PDF before showing it to anyone. ERC is silent about overlapping text. Typical fixes: move a note up, spread a stack, move a part. Change the coordinates in the table and build again.

Then run [verify-schematic](../verify-schematic/SKILL.md) `project-check` on the sheet and board. Until someone runs Update PCB from Schematic (F8) in the PCB Editor, it reports `missing_footprint` for every part. That is expected for a draft.

## 5. Hand over

The owner opens the sheet in KiCad, replaces labels with wires where that reads better, and reviews it. Delete `draft_nets.py` in the same commit as the first hand edit, so nobody regenerates over that work.
