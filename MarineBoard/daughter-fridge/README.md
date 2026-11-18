# Fridge daughter board

A small board that sits beside a [Marine Board](../README.md) and runs the National Luna Weekender fridge: Danfoss BD35F compressor, 101N0500 electronic unit. It plugs into the Marine Board's CN4 header with one 10-pin JST GH cable.

It adds what the Marine Board cannot do for this fridge on its own:

- four compressor speeds, 2,000 to 3,500 rpm, instead of full speed or stop
- an input for the Danfoss fault lamp output
- a hardware watchdog, so a hung ESP32 cannot hold the compressor stopped
- a second temperature probe bus with a protected supply

A dead ESP32 still leaves the compressor running at 3,500 rpm.

**Status:** schematic draft 0.1, not reviewed (#229). Start with [technical spec.md](technical%20spec.md), then the [schematic PDF](docs/daughter-fridge-schematic.pdf).

## Files

| File | What |
|---|---|
| [technical spec.md](technical%20spec.md) | The plan: gaps, connector, circuit blocks, tools, phases, decisions |
| `daughter-fridge.kicad_pro` | KiCad 10 project |
| `daughter-fridge.kicad_sch` | Schematic, draft 0.1, generated from `draft_nets.py` |
| [`draft_nets.py`](draft_nets.py) | Net table for the draft. Regenerate with the [draft-schematic](../kicad-skills/draft-schematic/SKILL.md) skill. Deleted at the first hand edit |
| [`docs/daughter-fridge-schematic.pdf`](docs/daughter-fridge-schematic.pdf) | PDF of the draft |
| `daughter-fridge.kicad_pcb` | Board, two layers, proposed outline only |
| `daughter-fridge.kicad_dru` | Isolation rule and PCBWay rules |
| `sym-lib-table`, `fp-lib-table` | Point at [`../Lib`](../Lib), shared with the Marine Board |

## Checks

Run from the repo root, with KiCad closed:

```bash
python3 -I MarineBoard/kicad-skills/scripts/draft_sch.py MarineBoard/daughter-fridge/daughter-fridge.kicad_pro MarineBoard/daughter-fridge/draft_nets.py
python3 MarineBoard/kicad-skills/scripts/kicad_sym.py project-check MarineBoard/daughter-fridge/daughter-fridge.kicad_sch --pcb MarineBoard/daughter-fridge/daughter-fridge.kicad_pcb
```

The first regenerates the sheet, runs ERC, checks the netlist against the table and writes the PDF. It reports 0 ERC violations and 97 pins on 29 nets with 0 problems. The second reports `missing_footprint` for every part until the PCB is updated from the schematic. That is expected for the draft.
