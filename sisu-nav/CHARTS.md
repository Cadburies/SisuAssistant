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
