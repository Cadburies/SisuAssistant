/**
 * Minimal MBTiles (spec 1.3, flat `tiles` table) writer on top of Node's
 * built-in `node:sqlite` — no native/npm sqlite dependency, no GDAL. Run
 * with `--experimental-sqlite` (see Dockerfile CMD); the module still
 * loads fine on Node versions where the flag is unnecessary.
 *
 * openMbtiles() reuses an existing file (#83 fill) instead of always inserting
 * a fresh metadata table.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { tileGrid } from './grid.mjs';

const tmsY = (z, y) => 2 ** z - 1 - y;

function upsertMeta(db, name, value) {
  db.prepare('DELETE FROM metadata WHERE name = ?').run(name);
  db.prepare('INSERT INTO metadata (name, value) VALUES (?, ?)').run(name, value);
}

function parseBounds(row) {
  if (!row?.value) return null;
  const n = String(row.value)
    .split(',')
    .map(Number);
  return n.length === 4 && n.every(Number.isFinite) ? n : null;
}

/**
 * Open or create an MBTiles file. If it already exists, keep tiles and only
 * widen bounds/zoom metadata when `meta` is provided.
 */
export function openMbtiles(filePath, meta) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const existed = fs.existsSync(filePath);
  const db = new DatabaseSync(filePath);
  db.exec('CREATE TABLE IF NOT EXISTS metadata (name text, value text)');
  db.exec(
    'CREATE TABLE IF NOT EXISTS tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob)',
  );
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS tile_index ON tiles (zoom_level, tile_column, tile_row)');

  const metaCount = db.prepare('SELECT count(*) AS n FROM metadata').get()?.n ?? 0;
  if (meta && (!existed || metaCount === 0)) {
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
    const putMeta = db.prepare('INSERT INTO metadata (name, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(entries)) putMeta.run(k, v);
  } else if (meta && existed) {
    const oldBounds = parseBounds(db.prepare("SELECT value FROM metadata WHERE name = 'bounds'").get());
    if (oldBounds) {
      const u = [
        Math.min(oldBounds[0], meta.bounds[0]),
        Math.min(oldBounds[1], meta.bounds[1]),
        Math.max(oldBounds[2], meta.bounds[2]),
        Math.max(oldBounds[3], meta.bounds[3]),
      ];
      upsertMeta(db, 'bounds', u.join(','));
    }
    const oldMin = Number(db.prepare("SELECT value FROM metadata WHERE name = 'minzoom'").get()?.value);
    const oldMax = Number(db.prepare("SELECT value FROM metadata WHERE name = 'maxzoom'").get()?.value);
    if (Number.isFinite(oldMin)) upsertMeta(db, 'minzoom', String(Math.min(oldMin, meta.minzoom)));
    if (Number.isFinite(oldMax)) upsertMeta(db, 'maxzoom', String(Math.max(oldMax, meta.maxzoom)));
  }

  const insertTile = db.prepare(
    'INSERT OR IGNORE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)',
  );
  const existsTile = db.prepare(
    'SELECT 1 FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?',
  );

  return {
    hasTile(z, x, y) {
      return !!existsTile.get(z, x, tmsY(z, y));
    },
    putTile(z, x, y, buf) {
      insertTile.run(z, x, tmsY(z, y), buf);
    },
    countAll() {
      return db.prepare('SELECT count(*) AS n FROM tiles').get()?.n ?? 0;
    },
    close() {
      db.close();
    },
  };
}

/** How many tiles in bbox/zoom are missing from an existing MBTiles file. */
export function countMissingTiles(filePath, bbox, minZoom, maxZoom) {
  const expected = tileGrid(bbox, minZoom, maxZoom);
  if (!fs.existsSync(filePath)) return expected.length;
  const mb = openMbtiles(filePath, null);
  try {
    let n = 0;
    for (const t of expected) {
      if (!mb.hasTile(t.z, t.x, t.y)) n += 1;
    }
    return n;
  } finally {
    mb.close();
  }
}

/** @deprecated use openMbtiles — kept name as alias so older callers still work. */
export const createMbtiles = openMbtiles;
