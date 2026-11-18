#!/usr/bin/env python3
"""
NV2 to MBTiles Converter

Converts Navionics .nv2 chart files to MBTiles format.
Supports T08 (SonarChart bathymetry) and MBM (Nautical Chart) tiles.

Usage:
    python nv2_to_mbtiles.py /path/to/tiles/T08/681/ output.mbtiles
    python nv2_to_mbtiles.py /path/to/tiles/MBM/ output.mbtiles
"""

import struct
import sqlite3
import os
import sys
import zlib
import gzip
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

# T08 Region Code to Name Mapping
T08_REGION_NAMES = {
    '681': 'Europe_North_Sea',
    '682': 'Europe_Baltic_Sea',
    '683': 'Europe_English_Channel',
    '684': 'Europe_Bay_of_Biscay',
    '685': 'Europe_Iberian_Peninsula',
    '686': 'Europe_Mediterranean_West',
    '687': 'Europe_Mediterranean_Central',
    '688': 'Europe_Mediterranean_East',
    '689': 'Europe_Adriatic_Sea',
    '690': 'Europe_Aegean_Sea',
    '691': 'Europe_Black_Sea',
    '692': 'Europe_Norway_South',
    '693': 'Europe_Norway_North',
    '694': 'Europe_Iceland',
    '695': 'Europe_Greenland_South',
    '696': 'Europe_Greenland_North',
    '697': 'North_Atlantic_East',
    '698': 'North_Atlantic_Central',
    '699': 'North_Atlantic_West',
    '700': 'North_America_East_Coast_North',
    '701': 'North_America_East_Coast_Mid_Atlantic',
    '702': 'North_America_East_Coast_South',
    '703': 'North_America_Gulf_of_Mexico_East',
    '704': 'North_America_Gulf_of_Mexico_Central',
    '705': 'North_America_Gulf_of_Mexico_West',
    '706': 'North_America_West_Coast_Pacific_NW',
    '707': 'North_America_West_Coast_California',
    '708': 'North_America_West_Coast_Baja',
    '709': 'North_America_Great_Lakes_Superior',
    '710': 'North_America_Great_Lakes_Michigan_Huron',
    '711': 'North_America_Great_Lakes_Erie_Ontario',
    '712': 'North_America_St_Lawrence_River',
    '713': 'North_America_Caribbean_North',
    '714': 'North_America_Caribbean_Central',
    '715': 'North_America_Caribbean_South',
    '716': 'Central_America_Pacific',
    '717': 'Central_America_Caribbean',
    '718': 'South_America_East_Coast_North',
    '719': 'South_America_East_Coast_South',
    '720': 'South_America_West_Coast_North',
    '721': 'South_America_West_Coast_South',
    '722': 'South_America_Southern_Cone',
    '723': 'Antarctica',
    '724': 'Africa_West_Coast_North',
    '725': 'Africa_West_Coast_South',
    '726': 'Africa_East_Coast_North',
    '727': 'Africa_East_Coast_South',
    '728': 'Africa_Southern_Tip',
    '729': 'Indian_Ocean_West',
    '730': 'Indian_Ocean_Central',
    '731': 'Indian_Ocean_East',
    '732': 'Australia_North',
    '733': 'Australia_East',
    '734': 'Australia_South',
    '735': 'Australia_West',
    '736': 'New_Zealand_North',
    '737': 'New_Zealand_South',
    '738': 'Pacific_Ocean_West',
    '739': 'Pacific_Ocean_Central',
    '740': 'Pacific_Ocean_East',
    '741': 'Asia_East_North',
    '742': 'Asia_East_South',
    '743': 'Asia_South_North',
    '744': 'Asia_South_South',
    '745': 'Asia_Southeast',
    '746': 'Middle_East_Mediterranean',
    '747': 'Middle_East_Red_Sea',
    '748': 'Middle_East_Persian_Gulf',
    '749': 'Arctic_Ocean',
}


def get_region_name(region_code: str) -> str:
    """Get the human-readable name for a region code."""
    return T08_REGION_NAMES.get(region_code, f"Unknown_Region_{region_code}")


class NV2Header:
    """NV2 file header structure."""

    MAGIC = b'\x50\x80\xfe\x00\xab\x73\x12\x08'

    def __init__(self, data: bytes):
        self.data = data
        self.parse()

    def parse(self):
        """Parse the NV2 header."""
        if len(self.data) < 128:
            raise ValueError("File too small to be a valid NV2 file")

        # Check magic bytes
        if self.data[:8] != self.MAGIC:
            raise ValueError(f"Invalid NV2 magic bytes: {self.data[:8].hex()}")

        # Parse header fields (offsets based on analysis)
        self.version = struct.unpack_from('<H', self.data, 8)[0]
        self.file_size = struct.unpack_from('<I', self.data, 12)[0]

        # Extract string metadata
        self.metadata = self._extract_strings()

    def _extract_strings(self) -> Dict[str, str]:
        """Extract string metadata from the file."""
        metadata = {}

        # Find and extract null-terminated strings
        strings = []
        current = []
        for byte in self.data[64:512]:  # Scan first 512 bytes for strings
            if 32 <= byte < 127:
                current.append(chr(byte))
            elif current:
                strings.append(''.join(current))
                current = []

        # Common metadata fields
        if strings:
            metadata['strings'] = strings[:20]  # First 20 strings
            metadata['title'] = strings[0] if strings else "Unknown"

        return metadata


class NV2Tile:
    """Represents a single NV2 tile."""

    def __init__(self, filepath: Path):
        self.filepath = filepath
        self.filename = filepath.stem
        self.data = filepath.read_bytes()
        self.header = NV2Header(self.data)
        self.tile_data = self._extract_tile_data()

    def _extract_tile_data(self) -> bytes:
        """Extract the actual tile data from the NV2 file."""
        # Skip header (first 512 bytes typically contain metadata)
        # The actual tile data follows
        header_size = 512

        if len(self.data) <= header_size:
            return self.data

        # Try to detect compression
        tile_data = self.data[header_size:]

        # Check for gzip
        if tile_data[:2] == b'\x1f\x8b':
            try:
                return gzip.decompress(tile_data)
            except:
                pass

        # Check for zlib
        try:
            return zlib.decompress(tile_data)
        except:
            pass

        # Check for deflate
        try:
            decompressor = zlib.decompressobj(-zlib.MAX_WBITS)
            return decompressor.decompress(tile_data)
        except:
            pass

        # Return raw data
        return tile_data

    def is_image(self) -> bool:
        """Check if tile data is an image."""
        if len(self.tile_data) < 4:
            return False

        # PNG signature
        if self.tile_data[:8] == b'\x89PNG\r\n\x1a\n':
            return True

        # JPEG signature
        if self.tile_data[:2] == b'\xff\xd8':
            return True

        # GIF signature
        if self.tile_data[:6] in [b'GIF87a', b'GIF89a']:
            return True

        return False


class MBTilesWriter:
    """Writes MBTiles format SQLite database."""

    def __init__(self, output_path: Path):
        self.output_path = output_path
        self.conn = sqlite3.connect(str(output_path))
        self.cursor = self.conn.cursor()
        self._create_schema()

    def _create_schema(self):
        """Create MBTiles schema."""
        self.cursor.executescript('''
            DROP TABLE IF EXISTS tiles;
            DROP TABLE IF EXISTS metadata;

            CREATE TABLE tiles (
                zoom_level INTEGER NOT NULL,
                tile_column INTEGER NOT NULL,
                tile_row INTEGER NOT NULL,
                tile_data BLOB NOT NULL,
                PRIMARY KEY (zoom_level, tile_column, tile_row)
            );

            CREATE TABLE metadata (
                name TEXT,
                value TEXT
            );
        ''')
        self.conn.commit()

    def set_metadata(self, key: str, value: str):
        """Set a metadata value."""
        self.cursor.execute(
            'INSERT OR REPLACE INTO metadata (name, value) VALUES (?, ?)',
            (key, value)
        )

    def add_tile(self, z: int, x: int, y: int, tile_data: bytes, format: str = 'png'):
        """Add a tile to the database."""
        self.cursor.execute(
            'INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)',
            (z, x, y, sqlite3.Binary(tile_data))
        )

    def close(self):
        """Close the database."""
        self.conn.commit()
        self.conn.close()


def parse_tile_filename(filename: str) -> Optional[Tuple[int, int, int]]:
    """
    Parse tile coordinates from filename.

    Supports formats like:
    - T08EUDRZ (needs region lookup)
    - BM028XL (needs region lookup)
    - z_x_y (standard format)
    """
    # Check for standard z_x_y format
    parts = filename.replace('.nv2', '').split('_')
    if len(parts) == 3:
        try:
            return (int(parts[0]), int(parts[1]), int(parts[2]))
        except ValueError:
            pass

    return None


def get_region_bounds(region_code: str) -> Optional[Tuple[float, float, float, float]]:
    """
    Get approximate bounds for a region code.

    Returns (min_lat, max_lat, min_lon, max_lon)
    """
    # Common region codes and their approximate bounds
    regions = {
        '681': (40.0, 50.0, -10.0, 20.0),  # Europe
        '682': (35.0, 45.0, -20.0, 10.0),  # Atlantic
        # Add more regions as needed
    }

    return regions.get(region_code)


def convert_t08_directory(input_dir: Path, output_path: Path):
    """Convert a T08 directory to MBTiles."""
    print(f"Converting T08 directory: {input_dir}")

    # Extract region code from directory name
    region_code = input_dir.name
    region_name = get_region_name(region_code)

    # If output_path doesn't include region name, add it
    if not output_path.name.startswith(f"T08_{region_name}_"):
        output_path = output_path.parent / f"T08_{region_name}_{output_path.stem}{output_path.suffix}"

    writer = MBTilesWriter(output_path)

    # Set metadata with region name
    writer.set_metadata('name', f'Navionics SonarChart T08 - {region_name}')
    writer.set_metadata('format', 'png')
    writer.set_metadata('type', 'baselayer')
    writer.set_metadata('description', f'Navionics SonarChart bathymetry tiles - Region {region_code}: {region_name}')
    writer.set_metadata('attribution', '© Navionics')
    writer.set_metadata('region_code', region_code)
    writer.set_metadata('region_name', region_name)
    writer.set_metadata('attribution', '© Navionics')

    tile_count = 0

    # Check if input_dir contains NV2 files directly or has subdirectories
    nv2_files_direct = list(input_dir.glob('*.nv2'))
    region_dirs = [d for d in input_dir.iterdir() if d.is_dir()]

    print(f"Found {len(nv2_files_direct)} NV2 files directly, {len(region_dirs)} subdirectories")

    # Process files in subdirectories (T08 structure: T08/<region_code>/<tiles>)
    for region_dir in sorted(region_dirs, key=lambda d: d.name):
        region_code = region_dir.name
        nv2_files = sorted(list(region_dir.glob('*.nv2')), key=lambda p: p.name)

        if not nv2_files:
            continue

        print(f"Processing region {region_code}...", end=' ')

        tile_index = 0
        for nv2_file in nv2_files:
            try:
                tile = NV2Tile(nv2_file)

                # For T08 tiles, we need to assign zoom/coordinates
                # Since the naming does not follow standard convention,
                # we will use a default zoom level and sequential coordinates
                z = 10  # Default zoom for T08 tiles

                # Try to extract coordinates from filename or use sequential
                coords = parse_tile_filename(nv2_file.name)
                if coords:
                    _, x, y = coords
                else:
                    # Use sequential coordinates to avoid hash collisions
                    x = tile_index % (1 << z)
                    y = (tile_index // (1 << z)) % (1 << z)
                    tile_index += 1

                # Check if it is an image
                if tile.is_image():
                    writer.add_tile(z, x, y, tile.tile_data, 'png')
                else:
                    # Store as binary data with .nv2 extension
                    writer.add_tile(z, x, y, tile.tile_data, 'nv2')

                tile_count += 1

            except Exception as e:
                print(f"  Error processing {nv2_file.name}: {e}")

        print(f"{len(nv2_files)} files")

    # Also process files directly in input_dir (if T08/<region_code> was passed)
    if nv2_files_direct:
        print(f"Processing {len(nv2_files_direct)} files in {input_dir.name}...", end=' ')

        # Sort files for consistent ordering
        nv2_files_direct = sorted(nv2_files_direct, key=lambda p: p.name)
        tile_index = 0

        for nv2_file in nv2_files_direct:
            try:
                tile = NV2Tile(nv2_file)

                z = 10  # Default zoom for T08 tiles

                coords = parse_tile_filename(nv2_file.name)
                if coords:
                    _, x, y = coords
                else:
                    # Use sequential coordinates to avoid hash collisions
                    x = tile_index % (1 << z)
                    y = (tile_index // (1 << z)) % (1 << z)
                    tile_index += 1

                if tile.is_image():
                    writer.add_tile(z, x, y, tile.tile_data, 'png')
                else:
                    writer.add_tile(z, x, y, tile.tile_data, 'nv2')

                tile_count += 1

            except Exception as e:
                print(f"  Error processing {nv2_file.name}: {e}")

        print(f"done")

    writer.set_metadata('minzoom', str(10))
    writer.set_metadata('maxzoom', str(10))
    writer.set_metadata('tilecount', str(tile_count))

    writer.close()
    print(f"\nConverted {tile_count} tiles to {output_path}")


def convert_mbm_directory(input_dir: Path, output_path: Path):
    """Convert an MBM directory to MBTiles."""
    print(f"Converting MBM directory: {input_dir}")

    writer = MBTilesWriter(output_path)

    # Set metadata
    writer.set_metadata('name', 'Navionics MBM Nautical Chart')
    writer.set_metadata('format', 'png')
    writer.set_metadata('type', 'baselayer')
    writer.set_metadata('description', 'Navionics nautical chart tiles')
    writer.set_metadata('attribution', '© Navionics')

    tile_count = 0

    nv2_files = list(input_dir.glob('*.nv2'))
    print(f"Found {len(nv2_files)} NV2 files")

    for nv2_file in nv2_files:
        try:
            print(f"Processing {nv2_file.name}...", end=' ')

            tile = NV2Tile(nv2_file)

            # MBM files are larger region files
            # Store at zoom level 8 with coordinates 0,0
            z = 8
            x = 0
            y = 0

            if tile.is_image():
                writer.add_tile(z, x, y, tile.tile_data, 'png')
            else:
                writer.add_tile(z, x, y, tile.tile_data, 'nv2')

            tile_count += 1
            print("done")

        except Exception as e:
            print(f"Error: {e}")

    writer.set_metadata('minzoom', str(8))
    writer.set_metadata('maxzoom', str(8))
    writer.set_metadata('tilecount', str(tile_count))

    writer.close()
    print(f"\nConverted {tile_count} tiles to {output_path}")


def convert_single_file(input_file: Path, output_path: Path):
    """Convert a single NV2 file to MBTiles."""
    print(f"Converting single file: {input_file}")

    writer = MBTilesWriter(output_path)

    # Set metadata
    writer.set_metadata('name', input_file.stem)
    writer.set_metadata('format', 'png')
    writer.set_metadata('type', 'baselayer')

    try:
        tile = NV2Tile(input_file)

        # Store at zoom 10, coordinates 0,0
        z = 10
        x = 0
        y = 0

        if tile.is_image():
            writer.add_tile(z, x, y, tile.tile_data, 'png')
        else:
            writer.add_tile(z, x, y, tile.tile_data, 'nv2')

        writer.set_metadata('minzoom', str(z))
        writer.set_metadata('maxzoom', str(z))
        writer.set_metadata('tilecount', '1')

        print(f"Converted to {output_path}")

    except Exception as e:
        print(f"Error: {e}")
        raise

    writer.close()


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        print("Examples:")
        print("  python nv2_to_mbtiles.py /path/to/T08/ output.mbtiles")
        print("  python nv2_to_mbtiles.py /path/to/MBM/ output.mbtiles")
        print("  python nv2_to_mbtiles.py /path/to/file.nv2 output.mbtiles")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    if not input_path.exists():
        print(f"Error: {input_path} does not exist")
        sys.exit(1)

    if input_path.is_file():
        if input_path.suffix.lower() != '.nv2':
            print(f"Error: {input_path} is not an .nv2 file")
            sys.exit(1)
        convert_single_file(input_path, output_path)
    elif input_path.is_dir():
        # Detect directory type
        if 'T08' in input_path.parts:
            convert_t08_directory(input_path, output_path)
        elif 'MBM' in input_path.parts:
            convert_mbm_directory(input_path, output_path)
        else:
            # Try to detect based on contents
            nv2_files = list(input_path.glob('*.nv2'))
            if nv2_files:
                # Check if it looks like T08 (many small files) or MBM (fewer large files)
                avg_size = sum(f.stat().st_size for f in nv2_files) / len(nv2_files)
                if avg_size < 10000:  # Small files = T08
                    convert_t08_directory(input_path, output_path)
                else:  # Large files = MBM
                    convert_mbm_directory(input_path, output_path)
            else:
                # Check subdirectories
                subdirs = [d for d in input_path.iterdir() if d.is_dir()]
                if subdirs:
                    # Looks like T08 structure
                    convert_t08_directory(input_path, output_path)
                else:
                    print("Unknown directory structure")
                    sys.exit(1)
    else:
        print(f"Error: {input_path} is not a file or directory")
        sys.exit(1)


if __name__ == '__main__':
    main()
