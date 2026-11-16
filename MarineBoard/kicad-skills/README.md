# KiCad skills

Skills for agents drawing Sisu schematics and placing footprints in KiCad 10. Each skill is a `SKILL.md`. The checks live in [`scripts/kicad_sym.py`](scripts/kicad_sym.py) and [`scripts/kicad_pcb.py`](scripts/kicad_pcb.py). Run the commands from the repo root.

KiCad on this Mac is 10.0.1, at `/Applications/KiCad/KiCad.app`. The CLI is `Contents/MacOS/kicad-cli` and is not on `PATH`. Set `KICAD_CLI` to point the script at another binary.

| Skill | Use when |
| --- | --- |
| [find-part](find-part/SKILL.md) | Before drawing anything. Search the libraries already on disk. |
| [create-symbol](create-symbol/SKILL.md) | The datasheet part is not in those libraries. Build a symbol from a pin table. |
| [place-footprints](place-footprints/SKILL.md) | Move footprints that are already on the board. |
| [check-board](check-board/SKILL.md) | Read positions, compare a placement table, and export copper pictures. |
| [verify-schematic](verify-schematic/SKILL.md) | After a symbol or a sheet changes. ERC, DRC, and the mistakes ERC skips. |

## Why a pin table and a script

KiCad 10 has no built-in assistant. `kicad-cli` can check a schematic (`sch erc`), check a board (`pcb drc`), and export a symbol picture (`sym export svg`). It cannot create a symbol. The PCB editor has an IPC socket. The schematic editor does not, until KiCad 11.

Published agent packs take three other routes. An MCP server places parts one call at a time. A plugin drives the open PCB editor. A Python engine rewrites the s-expression (`kx` in [KiSkill](https://github.com/AvatarSD/KiSkill), `kce` in [kicad-cli-extended](https://github.com/Hybirdss/kicad-cli-extended)). Those engines work. Vendoring one here would be a second toolchain to keep current, and this repo already has `kicad-cli`.

The smaller skills agree on the gate. [datasheet-to-symbol-lib](https://github.com/devbisme/datasheet-to-symbol-lib) writes the pinout to a checked file before any symbol exists, because a wrong pin in a plausible symbol does not throw. [kicad-harness](https://github.com/zxkmm/kicad-harness) looks up a real library id before it invents one. KiSkill and kicad-cli-extended both finish by asking `kicad-cli` whether the file opens.

This folder keeps that gate and skips the extra engine. The pin table is the checked file. `kicad_sym.py` is the only writer of symbol text. `kicad-cli` decides the file is real. Pin grid, pin length, electrical-type tokens, and the `MPN` / `Manufacturer` property names are fixed in the script.

A placement table is the same gate for a board. It lists the reference, x, y, rotation, and side. `kicad_pcb.py` is the only writer of those positions. `kicad-cli pcb export pos` and `pcb export svg` read the board back. The position file's Y sign is explained in [place-footprints](place-footprints/SKILL.md). A side change calls KiCad's `Flip` through KiCad's own Python, and only after `LoadBoard` has put the footprint on the board. The script does not build a free footprint and flip it. This folder has no routing skill. Quilter routes the copper. `fab_package.py` checks the finished board.

Which side a pin sits on is still a design choice. The KiCad library convention for that is [S4](https://klc.kicad.org/symbol/s4/).

## Project facts

- New symbols go in `MarineBoard/Lib/Sisu.kicad_sym`. `Lib/EasyEDA.kicad_sym` is the imported LCSC dump. The script will not write it.
- `MarineBoard/sym-lib-table` nicknames that dump `LCSC`. Footprints in `Lib/EasyEDA.pretty` use the same nickname. `fp-lib-table` nicknames the vendored Espressif footprints `PCM_Espressif`. A footprint field looks like `LCSC:SomeName`, `PCM_Espressif:ESP32-S3-WROOM-2`, or `Package_SO:SOIC-8_3.9x4.9mm_P1.27mm`.
- `MarineBoard/sym-lib-table` already has the `Sisu` row, URI `${KIPRJMOD}/Lib/Sisu.kicad_sym`. `Lib/Sisu.kicad_sym` starts empty. If `build` prints a row, that project's table is missing `Sisu`. Add it with KiCad closed. A project in a subfolder, such as `daughter-fridge/`, uses `${KIPRJMOD}/../Lib/Sisu.kicad_sym` in its own table. That nested table does not have the row yet.
- `MarineBoard/fab_package.py` reads properties `MPN` and `Manufacturer`.
- One physical board is one KiCad project. The main board is `MarineBoard/MarineBoard.kicad_pro`. The fridge daughter board is `MarineBoard/daughter-fridge/`. The files under `quilter-kicad8/` are a KiCad 8 upload set. Opening and saving them in KiCad 10 upgrades the file, and the upload then rejects it.
- Close KiCad before the script writes a file that session has open. The lock is a `~` file next to the project file. The script exits 2 when it sees one.
- These scripts will not write `MarineBoard/MarineBoard.kicad_sch`, `MarineBoard/MarineBoard.kicad_pcb`, anything under `v1.00/`, or anything under a quilter directory.

`python3 MarineBoard/kicad-skills/scripts/kicad_sym.py selftest` builds a throwaway symbol and runs it through `kicad-cli`. `python3 MarineBoard/kicad-skills/scripts/kicad_pcb.py selftest` places a throwaway footprint. Neither touches the board files.
