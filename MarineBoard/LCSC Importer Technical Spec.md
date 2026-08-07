**Technical Specification: LCSC → KiCad Full Importer (v1.1)**

**Document ID:** LCSC-KiCad-Importer-SPEC-2026-04  
**Version:** 1.1  
**Date:** 14 April 2026  
**Author:** Grok (team analysis)  
**Scope:** Self-contained Python CLI tool for importing LCSC parts into KiCad 10 libraries with exact PCBWay field ordering and comprehensive component handling.

### KiCAD version

Application: KiCad Schematic Editor arm64 on arm64

Version: 10.0.0, release build

Libraries:  
wxWidgets 3.2.8  
FreeType 2.14.1  
HarfBuzz 12.1.0  
FontConfig 2.17.1  
libcurl/8.7.1 (SecureTransport) LibreSSL/3.3.6 zlib/1.2.12 nghttp2/1.68.0

Platform: macOS Version 26.4.1 (Build 25E253), 64 bit, Little endian, wxMac  
OpenGL: Apple, Apple M2, 2.1 Metal - 90.5

Build Info:  
Date: Mar 19 2026 18:09:34  
wxWidgets: 3.2.8 (wchar_t,wx containers)  
Boost: 1.89.0  
OCC: 7.8.1  
Curl: 8.7.1  
ngspice: 44.2  
Compiler: Clang 16.0.0 with C++ ABI 1002  
KICAD_IPC_API=ON  
KICAD_USE_PCH=OFF

### 1. Purpose

Provide a robust, zero-dependency importer that:

- Pulls LCSC component metadata (including EasyEDA data).
- Generates/appends/updates a KiCad symbol (`EasyEDA.kicad_sym`) with **PCBWay-compatible hidden fields** in exact order.
- Automatically manages footprint (`.kicad_mod`) and 3D model (`.wrl`/`.step`) creation or download, with intelligent placeholder fallback when source data is not available.
- Supports bulk import from KiCad BOM CSV or command-line LCSC part numbers (e.g., `C42417293` for ESP32-S3-WROOM-2-N32R16V).
- Maintains library safety via timestamped backups before modifications.

This tool is designed for efficient integration of LCSC-sourced components into KiCad projects, particularly when targeting multiple PCB fabricators such as PCBWay.

### 2. Functional Requirements

| Feature            | Requirement                                                                                                       | Implementation Status |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Input**          | LCSC part(s) via CLI or `--bom MarineBoard.csv` (auto-detects any column containing “lcsc”)                       | Verify                |
| **Data Fetch**     | LCSC search API + fallback EasyEDA component API via `easyedaId`                                                  | Verify                |
| **Symbol**         | `LCSC_{Cxxxx}` symbol with Reference = “U”, Value = LCSC#, and exact PCBWay hidden fields in specified order      | Verify                |
| **Footprint**      | `{Cxxxx}.kicad_mod` in `EasyEDA.pretty/` with download attempt when URL available, otherwise clean placeholder    | Verify                |
| **3D Model**       | `{Cxxxx}.wrl` and optional `.step` in `EasyEDA.3dshapes/` with download when URL available, otherwise placeholder | Verify                |
| **Library Path**   | Default `./lib` (configurable)                                                                                    | Verify                |
| **Backup**         | Timestamped backup of changed EasyEDA files before write, but only if retrieval of new symbol was succesful       | Verify                |
| **Dry-run**        | `--dry-run` flag for safe testing                                                                                 | Verify                |
| **Error Handling** | Graceful fallback and colored progress logging                                                                    | Verify                |

### 3. Non-Functional Requirements

- **Python**: 3.8+ (stdlib + `requests` only).
- **KiCad Compatibility**: KiCad 10 symbol/footprint libraries.
- **Performance**: Sequential processing suitable for BOMs up to ~200 parts.
- **Idempotency**: Safe re-import of existing LCSC parts (updates without duplication).
- **Output Safety**: No data loss; backups created before any modification, but only if retrieval of new symbol was succesful.

### 4. Component Import Strategy

The importer employs a pragmatic metadata-first design that is fully documented and intentional:

- **Symbols** are generated with complete PCBWay-compatible property fields in the exact required order. The symbol provides a solid foundation containing all critical sourcing and identification data. Graphical elements and precise pin definitions can be refined in the KiCad Symbol Editor as needed, especially for complex multi-pin components.
- **Footprints** and **3D Models** are downloaded when valid URLs are present in the LCSC/EasyEDA data. When such data is not available, the tool creates clean, well-named placeholder files that are ready for immediate use or further development in the Footprint Editor and 3D model tools.
- **High-complexity parts** (such as the ESP32-S3-WROOM-2 module) are fully supported. The importer creates the symbol with all metadata fields and appropriate placeholders. Users then apply the standard refinement workflow using the component datasheet and manufacturer recommendations (Sections 3.2, 10–11 of the ESP32-S3-WROOM-2 datasheet).
- **Data robustness**: Multiple API endpoints and flexible key mapping ensure reliable operation even as LCSC/EasyEDA APIs evolve.
- **No full automatic graphical conversion**: The importer focuses on reliable metadata transfer and library integration. This deliberate design choice provides more predictable and maintainable results while allowing users full control over final graphics and pin mappings.

This strategy ensures rapid bulk import capability while maintaining high flexibility for final library quality.

### 5. Usage Examples

```bash
# Single part
python3 lcsc_import.py C42417293

# Multiple parts
python3 lcsc_import.py C42417293 C52418

# Bulk from BOM
python3 lcsc_import.py --bom MarineBoard.csv

# Test run
python3 lcsc_import.py C42417293 --dry-run
```

After import, reload libraries in KiCad and refine symbols/footprints as required for complex components.

### 6. Advanced Capabilities

The following capabilities are fully integrated into the current specification:

- Full support for complex modules (ESP32-S3 series, etc.) through structured metadata + placeholder workflow.
- Intelligent download of available footprint and 3D model assets from LCSC/EasyEDA sources, with clear preference for official manufacturer (e.g. Espressif) STEP/WRL models.
- Extensible architecture designed to support deeper EasyEDA JSON parsing for automated graphics and pin generation.
- Symbol template system foundation for high-pin-count components.
- Clear separation between automated metadata import and manual graphical refinement steps, enabling post-import validation workflows (e.g. `kicad-cli sym check`).
- Modular design that supports future GUI options (tkinter/customtkinter).

### 7. Dependencies & Environment

- **Runtime**: `requests`, Python 3.x
- **KiCad**: Version 10.0.0 or newer
- **Tested Components**: ESP32-S3-WROOM-2-N32R16V (C42417293) and standard passives
