# NV2 to MBTiles Converter

Converts Navionics `.nv2` chart files to MBTiles format for use with standard mapping libraries.

## Supported Formats

- **T08 tiles** (SonarChart™ bathymetry) - `tiles/T08/<region>/`
- **MBM tiles** (Nautical Chart base) - `tiles/MBM/`
- **Individual .nv2 files**

## Usage

```bash
# Convert a T08 region directory (output filename includes region name)
python nv2_to_mbtiles.py /path/to/tiles/T08/681/ output.mbtiles
# Creates: T08_Europe_North_Sea_output.mbtiles

# Convert an MBM directory
python nv2_to_mbtiles.py /path/to/tiles/MBM/ output.mbtiles

# Convert a single file
python nv2_to_mbtiles.py /path/to/file.nv2 output.mbtiles

# View MBTiles contents
python view_mbtiles.py output.mbtiles

# Extract tiles from MBTiles
python view_mbtiles.py output.mbtiles --extract --output-dir ./tiles
```

## Region Names

The converter automatically detects T08 region codes and includes human-readable names in:
- **Output filename**: `T08_<region_name>_<output>.mbtiles`
- **MBTiles metadata**: `region_code` and `region_name` fields

### Supported T08 Regions

| Code | Name |
|------|------|
| 681 | Europe_North_Sea |
| 682 | Europe_Baltic_Sea |
| 683 | Europe_English_Channel |
| 684 | Europe_Bay_of_Biscay |
| 685 | Europe_Iberian_Peninsula |
| 686 | Europe_Mediterranean_West |
| 687 | Europe_Mediterranean_Central |
| 688 | Europe_Mediterranean_East |
| 689 | Europe_Adriatic_Sea |
| 690 | Europe_Aegean_Sea |
| 691 | Europe_Black_Sea |
| 692-696 | Europe_Norway, Iceland, Greenland |
| 697-699 | North_Atlantic |
| 700-715 | North_America (East Coast, Gulf, West Coast, Great Lakes, Caribbean) |
| 716-722 | Central & South America |
| 723 | Antarctica |
| 724-728 | Africa |
| 729-731 | Indian_Ocean |
| 732-735 | Australia |
| 736-737 | New_Zealand |
| 738-740 | Pacific_Ocean |
| 741-745 | Asia |
| 746-748 | Middle_East |
| 749 | Arctic_Ocean |

See `region_names.py` for the complete mapping.

## Output

Creates an MBTiles SQLite database with:
- `tiles` table containing tile data
- `metadata` table with chart information including region name

## Viewing MBTiles

Use tools like:
- [MBUtil](https://github.com/mapbox/mbutil) - `mbutil serve output.mbtiles`
- [QGIS](https://qgis.org/) - Add MBTiles as raster layer
- [MapLibre GL JS](https://maplibre.org/) - Load as tile source
- [Leaflet](https://leafletjs.com/) - With mbtiles plugin

## Example with MapLibre GL JS

```javascript
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'sonarchart': {
                type: 'raster',
                tiles: ['http://localhost:3000/{z}/{x}/{y}.png'],
                tileSize: 256
            }
        },
        layers: [{
            id: 'sonarchart-layer',
            type: 'raster',
            source: 'sonarchart'
        }]
    }
});
```

## File Format

The `.nv2` format contains:
1. **Header** (8 bytes magic + metadata)
2. **String metadata** (chart names, region info)
3. **Tile data** (possibly compressed)

Magic bytes: `50 80 FE 00 AB 73 12 08`

## Limitations

- Tile coordinates are approximated (NV2 naming does not follow standard z/x/y convention)
- Compression detection is best-effort
- Some metadata may be lost in conversion

## License

MIT License
