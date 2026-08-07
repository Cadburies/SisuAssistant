## Final Implementation Plan

Enhance lcsc.py not only to retrieve the fields/data from LCSC, but also import the part(s) into KiCAD local project library {current/project folder}/lib as EasyEDA. Overwrite existing part numbers if they already exists.
I do not want to use easyeda2kicad, because it is not flexible enough. The issue is that it creates its own libraries and I already used impartGUI to import most components. KiCAD sees the impartGUI components first and therefore, don't see the additional information I need for PCBWay. My script must import the components too.

### 1. BOM File Format

- **KiCad export format** - I'll parse the standard KiCad BOM export format
- **Column headers:** I'll need to identify the LCSC part number column (likely "LCSC" or similar)

### 2. Field Positioning

- **Fields to import from LCSC:** Manufacturer, MPN, Package, Description, Datasheet, LCSC Part
- **Logical order:** Manufacturer, MPN, Package, Description, Datasheet, LCSC Part
- **User-friendly:** Fields will be positioned for easy reading in the symbol properties
- **Consistent positioning:** Same order for all symbols

### 3. Error Handling

- **Critical errors (red):** Invalid LCSC part numbers, API failures
  - Don't modify libraries
  - Report error and exit
- **Non-critical errors (yellow):** Missing field info
  - Continue with import
  - Report warning but proceed

### 4. Backup Strategy

- **Backup folder:** Create `backup/` inside project lib folder
- **Move old files:** Move easyeda2kicad library files to backup folder
- **No prompts:** Automatic backup without user confirmation

### 5. Progress Reporting

- **Verbose and colorful:** Detailed progress with color coding
- **Success (green):** Completed steps
- **Warnings (yellow):** Non-critical issues
- **Errors (red):** Critical failures

### 6. Default Library Location

- **Local project folder:** `/lib` as default location
- **Library files:** EasyEDA.kicad_sym, EasyEDA.pretty, EasyEDA.3dshapes

## Detailed Implementation Steps

### Phase 1: Library Migration & Management

1. **Create backup folder** in project lib directory
2. **Move easyeda2kicad library files** to backup folder
3. **Implement KiCad library parser** for reading/writing symbol libraries
4. **Add library migration functions** to move symbols, footprints, and 3D models

### Phase 2: Enhanced Import Functionality

1. **BOM File Parser**
   - Read KiCad BOM export format
   - Extract LCSC part numbers
   - Handle both single parts and BOM files

2. **Symbol Management**
   - Check if symbol exists in EasyEDA.kicad_sym
   - Update existing symbols with new fields
   - Add new symbols if they don't exist
   - Handle duplicate symbols gracefully

3. **Field Management**
   - Add standard fields in logical order
   - Set field
