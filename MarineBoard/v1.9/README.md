# Marine Board v1.9 — frozen production release

**Status:** frozen. Five boards were ordered from PCBWay; the silkscreen reads **v1.9**. There is no v1.10 production board.

| Identity | Value |
|---|---|
| PCBWay order | `W831004AS1P18` (5 units) |
| Source tag | `marineboard-v1.9` |
| Archive commit | `c7cd9fce82173eaabc6744c6bca5570d2f024bfb` |
| Board revision | v1.9, post-#183 build |
| Current design | **v1.10** — no board; see [`../Technical Specs.md`](../Technical%20Specs.md) |

## Artifacts

| Artifact | SHA-256 |
|---|---|
| `production/MarineBoard-PCBWay-Gerbers.zip` | `dfd3adb874b3c69be8a9efc178a2a5839bd6130a886f9f67b2b3c80aecf6c66c` |
| `MarineBoard.kicad_pcb` | `87fa777548dfb947d72a8f7c78f5911858d7487a2c00558545ebbc3a95c46430` |
| `MarineBoard.kicad_sch` | `5027f02ffd143dbc35bd6a6426ad45e68c000b6e42c8e8b6b32ec7c2235c32b8` |
| `production/MarineBoard-BOM.csv` | `56deb6092af6ae4d8052c2481808b165725d8f2401081489de0f95a7098b2144` |

## What is here

- `MarineBoard.kicad_sch` / `.kicad_pcb` / `.kicad_pro` / `.kicad_prl` — frozen KiCad 10 project.
- `production/` — gerbers, BOM, positions and order package.
- `PCBWay/` — PCBWay order and BOM replies.
- `Schematics/` — exported schematic sheets.
- `enclosure/` — enclosure sources and fit files.

Do not edit this folder. It is the manufacturing record for the five boards, not a second working tree. The root `production/` package remains the v1.9 order package; do not rebuild it for v1.10.

## What to read for a v1.9 board

- **Install / test / exposure:** [`../temp-fix-v1.9.md`](../temp-fix-v1.9.md) — the active v1.9 risk and solderless-mitigation document.
- **Current design:** [`../Technical Specs.md`](../Technical%20Specs.md) — describes **v1.10** source, no board.
- **Future corrections:** the current spec's [Next spin](../Technical%20Specs.md#next-spin--decided-changes-not-fitted-on-v19) section — **not fitted on v1.9**.
- **Design history:** git history at the archive commit above. This folder carries no second prose spec.

**Copper identity:** the archived v1.9 gerbers are byte-identical in copper to the current v1.10 source; re-check the hashes above before relying on that. No v1.10 board exists.
