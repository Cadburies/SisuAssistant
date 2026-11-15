---
name: verify-schematic
description: Check a KiCad 10 symbol, schematic, or board with kicad-cli after a Sisu schematic change. Use when a .kicad_sym, .kicad_sch, or .kicad_pcb was edited.
---

# Check a KiCad schematic

Use this after [create-symbol](../create-symbol/SKILL.md) or any edit to a sheet. The binary, the library nicknames, and the files the script refuses to write are in the [folder README](../README.md).

## A new symbol

```bash
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py check MarineBoard/Lib/Sisu.kicad_sym PART
```

Read the lines it prints. `pin_not_connected` and `power_pin_not_driven` on that lone copy mean KiCad loaded the pins. `lib_symbol_issues` on that copy means the throwaway sheet has no symbol library table. The main project table already has `Sisu`. Any other ERC error means the symbol is wrong. Fix the pin table and `build` again. A pin connection point off the 2.54 mm grid makes `check` exit 1.

Open the SVG path it prints. A pin on the wrong side is fixed in the pin table, then built again.

## A sheet

```bash
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py project-check path/to/sheet.kicad_sch --pcb path/to/board.kicad_pcb
```

Exit 0 means ERC and DRC reported nothing at error or warning level. Exit 1 means KiCad ran and found violations. Read them. The command writes its reports under a temp directory and does not save the board.

ERC does not catch a duplicated reference (`U1` used twice) or an unannotated `U?`. After `project-check`, search the sheet for those.

Close KiCad first when the script exits 2 because of a `~` lock file. A save from the open session writes the file it has in memory back over a script edit.
