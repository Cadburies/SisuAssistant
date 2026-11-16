---
name: check-board
description: Read footprint positions from a KiCad board, compare them to a placement table, and export copper SVGs. Use when checking a board without moving parts.
---

# Check a board

Read-only. `list` prints the position stored in the board file. `check` compares a placement table to `kicad-cli pcb export pos`. The Y sign is in [place-footprints](../place-footprints/SKILL.md). `picture` writes one SVG for F.Cu and one for B.Cu.

```bash
python3 MarineBoard/kicad-skills/scripts/kicad_pcb.py list path/to/board.kicad_pcb
python3 MarineBoard/kicad-skills/scripts/kicad_pcb.py check path/to/board.kicad_pcb path/to/table.json
python3 MarineBoard/kicad-skills/scripts/kicad_pcb.py picture path/to/board.kicad_pcb --out /tmp/board-svg
```

DRC with schematic parity is `kicad_sym.py project-check` in [verify-schematic](../verify-schematic/SKILL.md). `picture` and `check` do not save the board.
