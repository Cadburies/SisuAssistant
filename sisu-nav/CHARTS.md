# Navionics Chart Files Analysis

Extracted from APK version 24.5.1 (2026-11-05)

## File Formats Found

### .nv2 Files (Navionics V2)

**Location**: `assets/basemap/plani.nv2` (1.7 MB)

**Format**: Proprietary binary format
- Magic bytes: `50 80 FE 00 AB 73 12 08`
- Contains "Marine e-chart" string at offset 0x12E
- Appears to be a world planisphere/base chart file

### .erpd Files (Electronic Region Product Definition)

**Location**: `assets/basemap/RPDs.zip` (40 files, ~1.2 MB total)

**Format**: Proprietary binary (possibly encrypted/compressed)

**Regions defined**:
| File | Size | Region |
|---|---|---|
| USCHMP_001.erpd | 19.8 KB | US Commercial Marine Package |
| USHMP_001.erpd | 432 KB | US Home Ports Marine |
| EU_001.erpd | 55.8 KB | Europe |
| UKHO_001.erpd | 25.9 KB | UK Hydrographic Office |
| CSAMERICA_001.erpd | 121 KB | Central & South America |
| AFRICA_ASIA_001.erpd | 193 KB | Africa & Asia |
| OCEANIA_001.erpd | 2.9 KB | Oceania |
| ... | ... | 33 more regions |

### Basemap Tiles (.zip)

**Location**: `assets/basemap/basemaps.zip` (44.6 MB)

**Contents**: 21 BM*.XL.zip files (e.g., BM028XL.zip, BM031XL.zip)
- These appear to be raster basemap tiles
- Version: 20261029 (from basemaps.properties)

### Overlay Coverage

**Location**: `assets/overlay_coverage.json`

Defines two overlay types:
- **ap**: 27 regions (global coverage)
- **ap2**: 4 regions (limited: 4XG, CSAMERICA, USCHMP, USHMP)

## Downloaded Chart Files (from phone storage)

### T08 Tiles - SonarChart™ Bathymetry

**Location**: `tiles/T08/<region_code>/<tile_name>.nv2`

**Count**: 22,093 files (~1.5 GB)

**Structure**:
```
tiles/T08/
├── 681/
│   ├── T08EUDRZ.nv2
│   ├── T08EUDRZ.ugd
│   ├── T08EUDSE.nv2
│   └── ...
├── 682/
├── 683/
└── ... (198 region directories)
```

**Format**: Same .nv2 format as planisphere
- Contains "Marine e-chart" and "Navionics Mobile Chart" strings
- Contains bathymetry/depth data for SonarChart layer
- Paired with .ugd (User Generated Data) files

**Purpose**: These are the **SonarChart™ tiles** - the main chart layer showing bathymetry/depth contours. When you select "SonarChart" in the Map Options, the app loads tiles from the T08 directory.

### T32 Tiles - S-57 ENC Charts

**Location**: `tiles/T32/<region_code>/<tile_name>.s57`

**Count**: 539 files (~26 MB)

**Structure**:
```
tiles/T32/
├── 124/
├── 125/
├── 170/
└── ... (56 region directories)
```

**Format**: S-57 ENC format (IHO standard)
- Magic bytes: `50 80 FE 00 AB 73 12 08` (same header as .nv2)
- Contains "Marine e-chart" string
- Standard S-57 vector chart data

**Purpose**: Official S-57 Electronic Navigational Charts

### MBM Tiles - Nautical Chart Base

**Location**: `tiles/MBM/<tile_name>.nv2`

**Count**: 21 files (~81 MB)

**Files**: BM028XL.nv2, BM029XL.nv2, BM030XL.nv2, etc.

**Purpose**: Base nautical chart tiles (coarse resolution)

### LSC Files - Live Sonar Chart Data

**Location**: `tiles/lsc/<tile_name>.lsd`

**Count**: 42 files (~184 KB)

**Format**: Binary, magic bytes `DEAD BEFC`
- Contains user-collected sonar/bathymetry data
- "Live Sonar Chart" - crowdsourced depth data

**Purpose**: User-contributed sonar data overlay

### UGD Files - User Generated Data

**Location**: Paired with T08 tiles as `.ugd` files

**Count**: 22,093 files

**Purpose**: User annotations, waypoints, and custom data

## Map Mode Handling

From APK strings:
- `MapModeDefault` - Standard nautical chart
- `MapModeS57` - S-57 ENC charts (T32 tiles)
- `MapModeSonarCharts` - SonarChart™ bathymetry (T08 tiles)

Class: `lit/navionics/map/OnSonarChartsTilesAndRegionsHandling;`

## .nv3 Files

**No `.nv3` files found** in the APK or phone storage. Grok's information may be outdated or refer to a different Navionics product. The app uses:
- `.nv2` for all chart tiles (T08, MBM, planisphere)
- `.s57` for S-57 ENC data
- `.lsd` for Live Sonar Chart data

## Summary

| Format | Purpose | Location | Count | Size |
|---|---|---|---|---|
| .nv2 (T08) | **SonarChart™ bathymetry** | tiles/T08/ | 22,093 | ~1.5 GB |
| .s57 (T32) | S-57 ENC charts | tiles/T32/ | 539 | ~26 MB |
| .nv2 (MBM) | Nautical chart base | tiles/MBM/ | 21 | ~81 MB |
| .lsd | Live Sonar Chart | tiles/lsc/ | 42 | ~184 KB |
| .ugd | User Generated Data | tiles/T08/ | 22,093 | ~21 MB |
| .nv2 | Base planisphere | APK assets | 1 | 1.7 MB |
| .erpd | Region definitions | APK assets | 40 | ~1.2 MB |

## Key Finding

**SonarChart™ tiles are stored as `.nv2` files in `tiles/T08/` directory**, not as `.nv3` files. The T08 tiles contain bathymetry/depth data and are organized by region code (198 regions).

## Poseidon zoom profile and phase-4 measurements

A Poseidon export may carry `zoom-profile.json` beside `poseidon-nav.mbtiles`
(and the same for each other chart). `api/chartbundle/index.mjs` serves it as
an optional part. The schema/example is `poseidon-zoom-profile.example.json`.
The browser loader is `web/src/plugins/map/poseidonZoomProfile.ts`: a missing
or invalid file falls back to the Poseidon style minzoom table
(7/9/10/11/12/13/14). A profile may raise a chart floor, never lower the hard
caps: Nav/Sonar z10, S-57 detail z8, S-57 z7. The chart ladder is deliberately
off (`POSEIDON_LADDER_ENABLED = false`) until measured.

`DETAIL_BANDS` in `web/src/plugins/map/layers.ts` maps Overview ≤z7 → Minimal,
Coastal z8–11 → Navigation, Approach z12–14 → Navigation, Harbor z15+ → Full.
Fresh state is manual Navigation. Auto follows zoom; a manual preset freezes,
and editing any chart group switches the select to Custom.

### Measured on the F8 (headless WebKit, BVI, one run)

| View | Before z6 | After z6 | Before z10 | After z10 | Before z13 | After z13 |
|---|---:|---:|---:|---:|---:|---:|
| `moveend`→`idle` | 18.3 s | 4.0 s | 12.3 s | 4.0 s | 14.7 s | 1.8 s |

The z6 request was 152 tile events before the source floor, and **0 Poseidon
tile events after**; the source is added with `minzoom: 10` (or a profile
floor), and all 64 layers get the same floor. z13 repeat pans were served from
MapLibre's source cache: after the first visit, the Poseidon source emitted
no new tile events on revisits. A 3-pair repeat-pan p50 was 8.0 s before and
5.0 s after (38% lower); the 6-pair medians were 3.2 s / 3.7 s, so treat the
repeat-pan target as noisy rather than a clean win. Actual numbers, not a
guarantee.

### Gzip sample (copy only; archive not rewritten)

Raw Poseidon MBTiles tiles are uncompressed PBF (`0x1a...`). On sampled
z10–14 tiles from `poseidon-s57-detail`, gzip/original ratios were:

| z10 | z11 | z12 | z13 | z14 |
|---:|---:|---:|---:|---:|
| 0.413 | 0.523 | 0.674 | 0.781 | 0.845 |

`poseidon-nav` sampled 0.633/0.673/0.800/0.713/0.731. The experiment wrote
one gzipped sample copy to `/tmp`, decoded it byte-for-byte, and checked the
PBF wire prefix; no archive was rewritten. A larger full-archive experiment
is phase 5, not this change.

### Cache headers

`tileserver/entrypoint.sh` writes `maxAge: 604800`; tileserver-gl v5.7.0 does
not emit a `Cache-Control` header for `/data/...` tiles anyway (it emits
`ETag`). The functional cache is MapLibre's source cache plus the revision-
busting `?v=<mtimeMs>:<bytes>` URLs. Chart bundle style/sprite/outline fetches
use the same revision and are cached; the browser's chart list/provider poll
is cached for 30 s/60 s.

## Poseidon z0–8 overview (#256)

The source Poseidon export repeats full-detail features at every zoom: the
`poseidon-nav` z0 tile alone is 452.8 MB. The source z0–8 tiles repeat that same full detail at each zoom, while z9 is
the handoff. The builder's `--per-tile` mode filters, simplifies and
re-encodes z0–8 at their own zoom (a z9 pyramid loses map-block land/depth
polygons at world scale); the z9 handoff and the source archive are never
modified. This is post-processing because the exporter has no low-zoom
`/simplify` export option.

```bash
cd sisu-nav/tools/poseidon-overview
npm ci
node generate.mjs \
  --source ../../tiles/manual/poseidon-nav/poseidon-nav.mbtiles \
  --out ../../tiles/manual/poseidon-nav-overview \
  --name poseidon-nav-overview \
  --per-tile --force
```

The tool writes `poseidon-nav-overview.mbtiles`, `meta.json`, `style.json`,
`sprite.*`, `coverage.geojson`, and `regions.geojson`. It is a separate chart
row (`Nautical Chart overview`) and can be removed independently. Labels,
soundings, POIs, the map-block mesh, roads, rivers, bridges and overhead
cables are intentionally absent below z9. Land/base fills survive every
overview zoom; depth areas/contours, hazards, cables, routes and restricted
areas start at z3, when their records become area/line features rather than
one-pixel fragments. At z0 fragmented land/base polygons are dissolved. The
source bounds, attribution and style are copied. Archives are data and stay
out of git.

For a source whose map-block polygons survive a z9 pyramid, omit
`--per-tile`; that mode is kept for the z9 handoff experiments. Otherwise
use `--per-tile`. Generate the other variants with the same command and their source archive
(`poseidon-sonar`, `poseidon-s57`, `poseidon-s57-detail`); the overview name
is `<source>-overview`. Disk: source plus output; the source archives must be
backed up before generation. The current source data is ~65 GB on the Mac
(Nav 22 GB, Sonar 39 GB, S-57 1.5 GB, detail 2.4 GB); an overview is a
separate archive and does not replace them.

The per-tile BVI subset z0 tile is **37 KB** after dissolving fragmented land
(the source z0 is **452.8 MB**). S-57 overview z0 is **11 KB**; S-57 detail
**3.7 KB** (after dissolving z0 land). A z9 handoff sample (source
`164/282` → z8 `82/141`) still has every major source layer; `compare.mjs`
reproduces that check and exits non-zero on a missing major layer.
