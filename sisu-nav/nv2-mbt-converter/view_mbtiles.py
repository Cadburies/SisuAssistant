#!/usr/bin/env python3
"""
MBTiles Viewer

Extracts and displays tiles from an MBTiles file.

Usage:
    python view_mbtiles.py output.mbtiles [--extract] [--output-dir ./tiles]
"""

import sqlite3
import sys
import os
from pathlib import Path
from typing import Optional


def list_tiles(mbtiles_path: Path):
    """List all tiles in an MBTiles file."""
    conn = sqlite3.connect(str(mbtiles_path))
    cursor = conn.cursor()

    print(f"Metadata:")
    cursor.execute('SELECT name, value FROM metadata')
    for name, value in cursor.fetchall():
        print(f"  {name}: {value}")

    print(f"\nTiles:")
    cursor.execute('SELECT zoom_level, tile_column, tile_row, length(tile_data) FROM tiles ORDER BY zoom_level, tile_row, tile_column')
    tiles = cursor.fetchall()

    print(f"  Total tiles: {len(tiles)}")

    # Group by zoom level
    zoom_levels = {}
    for z, x, y, size in tiles:
        if z not in zoom_levels:
            zoom_levels[z] = []
        zoom_levels[z].append((x, y, size))

    for z in sorted(zoom_levels.keys()):
        tiles_at_z = zoom_levels[z]
        print(f"  Zoom {z}: {len(tiles_at_z)} tiles")
        if len(tiles_at_z) <= 10:
            for x, y, size in tiles_at_z:
                print(f"    [{z}/{x}/{y}] {size} bytes")
        else:
            for x, y, size in tiles_at_z[:5]:
                print(f"    [{z}/{x}/{y}] {size} bytes")
            print(f"    ... and {len(tiles_at_z) - 5} more")

    conn.close()


def extract_tiles(mbtiles_path: Path, output_dir: Path):
    """Extract all tiles from an MBTiles file."""
    conn = sqlite3.connect(str(mbtiles_path))
    cursor = conn.cursor()

    output_dir.mkdir(parents=True, exist_ok=True)

    cursor.execute('SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles ORDER BY zoom_level, tile_row, tile_column')

    count = 0
    for z, x, y, tile_data in cursor.fetchall():
        # Create zoom level directory
        zoom_dir = output_dir / str(z)
        zoom_dir.mkdir(exist_ok=True)

        # Save tile
        tile_path = zoom_dir / f"{x}_{y}.nv2"
        tile_path.write_bytes(tile_data)
        count += 1

    conn.close()
    print(f"Extracted {count} tiles to {output_dir}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    mbtiles_path = Path(sys.argv[1])

    if not mbtiles_path.exists():
        print(f"Error: {mbtiles_path} does not exist")
        sys.exit(1)

    extract = '--extract' in sys.argv
    output_dir = Path('./tiles')

    for i, arg in enumerate(sys.argv):
        if arg == '--output-dir' and i + 1 < len(sys.argv):
            output_dir = Path(sys.argv[i + 1])

    if extract:
        extract_tiles(mbtiles_path, output_dir)
    else:
        list_tiles(mbtiles_path)


if __name__ == '__main__':
    main()
