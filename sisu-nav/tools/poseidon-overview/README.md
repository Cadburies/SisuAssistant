# Poseidon overview builder

Offline z0–8 companion archives for the Poseidon charts (#256). The source
export repeats full-detail features at every zoom. `--per-tile` reprocesses
source z0–8 at their own zoom (keeping land/base map-block polygons at world
scale); at z0 fragmented land/base polygons are dissolved so the world is a
single usable fill rather than 95k one-pixel fragments. Without `--per-tile`
the tool builds a z9 quadtree pyramid. Both drop layers
that are not drawn at world/coastal zooms, simplify geometry, and leave
z9/source untouched.

The source MBTiles is opened read-only. The output is a separate
`poseidon-<variant>-overview/` directory with its own archive, metadata,
style, sprite, coverage and regions; it can be removed independently.

## Run

```bash
cd sisu-nav/tools/poseidon-overview
npm ci
node generate.mjs \
  --source ../../tiles/manual/poseidon-nav/poseidon-nav.mbtiles \
  --out ../../tiles/manual/poseidon-nav-overview \
  --name poseidon-nav-overview \
  --per-tile --force
```

Node 24+ (`node:sqlite`). Back up the source archive and have room for the
source plus output. Generate the other variants by changing the source/name:
`poseidon-sonar`, `poseidon-s57`, `poseidon-s57-detail`.

The generated directory is data, not source; it stays out of git. Point
`SISU_TILES_DIR` at the tree or copy the directory to the F8
`tiles/manual/` volume. `tileserver-gl` reloads directory-mode files.

## Layer policy

Dropped for z0–8: labels, soundings, points/POIs, places, light sectors, rock
points, the map-block mesh (`base_line`), roads, rivers, canals, bridges,
overhead cables/pipes and the high-zoom sonar layer. At z0–2 the tiny route
fragments (`resare`, `cblsub`, `rectrc`, `uwtroc`) are also dropped; at z0
the full-detail contour/shoreline lines (`depcnt`, `slcons`, `unknown`) are
omitted so world land/depth fills stay under 5 MB.

Retained and simplified: `base_area`, `lndare`, `depare`, `bathy`, `depcnt`
(z3+), `seaare`, `resare`, `achare`, `cblsub`, `rectrc`, `ctnare`, `sbdare`,
`ospare`, `slcons` (z3+), `uwtroc`, `wrecks`, `unknown` (z3+).

## Check the handoff

```bash
node compare.mjs \
  --source ../../tiles/manual/poseidon-nav/poseidon-nav.mbtiles \
  --overview /tmp/poseidon-nav-overview-bvi/poseidon-nav-overview.mbtiles \
  --z 9 --x 164 --row 282
```

It reads the fixed source z9 tile and its overview z8 parent, lists every
major source layer, and exits non-zero when a layer is missing. Labels and
soundings are intentionally absent from the overview.

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--source` | required | source `.mbtiles` |
| `--out` | source dir + `<name>` | output directory |
| `--name` | `<source>-overview` | chart/archive slug |
| `--maxzoom` | 8 | highest overview zoom |
| `--simplify` | 1 | Douglas–Peucker tolerance in tile units |
| `--min-line` | 1 | drop shorter lines; scales up at lower zooms |
| `--min-area` | 1 | drop smaller polygons; scales up at lower zooms |
| `--bbox` | whole archive | test subset `w,s,e,n` |
| `--per-tile` | off | reprocess source z0–8 in place (recommended for Poseidon) |
| `--force` | off | replace an existing output directory |
| `--dry-run` | off | read/count only, no output |
