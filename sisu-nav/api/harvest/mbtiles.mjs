/**
 * Minimal MBTiles (spec 1.3, flat `tiles` table) writer on top of Node's
 * built-in `node:sqlite` — no native/npm sqlite dependency, no GDAL. Run
 * with `--experimental-sqlite` (see Dockerfile CMD); the module still
 * loads fine on Node versions where the flag is unnecessary.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} filePath absolute path to the .mbtiles file to create
 * @param {{name:string, format:string, bounds:number[], minzoom:number,
 *   maxzoom:number, attribution?:string, description?:string}} meta
 */
export function createMbtiles(filePath, meta) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec('CREATE TABLE IF NOT EXISTS metadata (name text, value text)');
  db.exec(
    'CREATE TABLE IF NOT EXISTS tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob)',
  );
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS tile_index ON tiles (zoom_level, tile_column, tile_row)');

  const putMeta = db.prepare('INSERT INTO metadata (name, value) VALUES (?, ?)');
  const entries = {
    name: meta.name,
    format: meta.format,
    type: 'baselayer',
    version: '1.0.0',
    description: meta.description || meta.name,
    bounds: meta.bounds.join(','),
    minzoom: String(meta.minzoom),
    maxzoom: String(meta.maxzoom),
    attribution: meta.attribution || '',
  };
  for (const [k, v] of Object.entries(entries)) putMeta.run(k, v);

  const insertTile = db.prepare(
    'INSERT OR IGNORE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)',
  );
  const existsTile = db.prepare(
    'SELECT 1 FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?',
  );

  // MBTiles stores rows TMS-style (y flipped from the XYZ scheme every
  // provider template + the web map itself uses) — flip once, here, so
  // every fetcher just deals in ordinary XYZ y.
  const tmsY = (z, y) => 2 ** z - 1 - y;

  return {
    hasTile(z, x, y) {
      return !!existsTile.get(z, x, tmsY(z, y));
    },
    putTile(z, x, y, buf) {
      insertTile.run(z, x, tmsY(z, y), buf);
    },
    close() {
      db.close();
    },
  };
}
