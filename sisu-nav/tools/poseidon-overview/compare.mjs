#!/usr/bin/env node
/**
 * Compare a fixed z9 source handoff tile with its z8 overview parent (#256).
 * The overview is intentionally generalized: labels/soundings/POIs are absent,
 * but every style-visible major layer must exist and the source geometry must
 * be inside the overview parent.
 */
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const DROP = new Set([
  'base_line', 'labels', 'poi', 'places', 'soundg', 'lightsec', 'sonar',
  'rockpts', 'points', 'roaedg', 'rivers', 'canals', 'bridge', 'cblohd', 'pipohd', 'pipsol',
]);

const args = parse(process.argv.slice(2));
if (!args.source || !args.overview) usage();
const z = Number(args.z ?? 9);
const x = Number(args.x ?? 164);
const row = Number(args.row ?? 282);
const parentZ = z - 1;
const yTop = 2 ** z - 1 - row;
const parentX = x >> 1;
const parentY = yTop >> 1;
const parentRow = 2 ** parentZ - 1 - parentY;

const source = readTile(args.source, z, x, row);
const overview = readTile(args.overview, parentZ, parentX, parentRow);
const sourceLayers = majorLayers(source);
const overviewLayers = majorLayers(overview);
const missing = [...sourceLayers.keys()].filter((name) => !overviewLayers.has(name));
const layers = {};
for (const [name, sourceLayer] of sourceLayers) {
  const target = overviewLayers.get(name);
  layers[name] = {
    sourceFeatures: sourceLayer.length,
    overviewFeatures: target?.length ?? 0,
    sourceBounds: bounds(sourceLayer, (p) => [
      (x - parentX * 2) * 2048 + p.x / 2,
      (yTop - parentY * 2) * 2048 + p.y / 2,
    ]),
    overviewBounds: target ? bounds(target) : null,
  };
}
const result = {
  source: { z, x, row, bytes: readBytes(args.source, z, x, row) },
  overview: { z: parentZ, x: parentX, row: parentRow, bytes: readBytes(args.overview, parentZ, parentX, parentRow) },
  sourceLayers: [...sourceLayers.keys()].sort(),
  overviewLayers: [...overviewLayers.keys()].sort(),
  missing,
  layers,
  geometryWithinParent: Object.values(layers).every((row) => row.sourceBounds && (!row.overviewBounds || contains(row.overviewBounds, row.sourceBounds))),
  ok: missing.length === 0 && Object.values(layers).every((row) => row.overviewFeatures > 0),
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

function majorLayers(tile) {
  const out = new Map();
  for (const [name, layer] of Object.entries(tile.layers)) {
    if (!DROP.has(name)) out.set(name, layer);
  }
  return out;
}

function bounds(layer, transform = (p) => [p.x, p.y]) {
  let b = null;
  for (let i = 0; i < layer.length; i++) {
    for (const ring of layer.feature(i).loadGeometry()) {
      for (const raw of ring) {
        const p = { x: transform(raw)[0], y: transform(raw)[1] };
        b = b ? [Math.min(b[0], p.x), Math.min(b[1], p.y), Math.max(b[2], p.x), Math.max(b[3], p.y)] : [p.x, p.y, p.x, p.y];
      }
    }
  }
  return b;
}

function contains(outer, inner) {
  const pad = 300; // 64-unit tile buffer plus low-zoom simplification
  return outer[0] <= inner[0] + pad && outer[1] <= inner[1] + pad && outer[2] >= inner[2] - pad && outer[3] >= inner[3] - pad;
}

function readTile(file, zoom, column, tileRow) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rec = db.prepare('select tile_data from tiles where zoom_level=? and tile_column=? and tile_row=?').get(zoom, column, tileRow);
    if (!rec) throw new Error(`missing tile ${zoom}/${column}/${tileRow} in ${file}`);
    let buf = new Uint8Array(rec.tile_data);
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = new Uint8Array(zlib.gunzipSync(buf));
    return new VectorTile(new PbfReader(buf));
  } finally {
    db.close();
  }
}

function readBytes(file, zoom, column, tileRow) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rec = db.prepare('select length(tile_data) as n from tiles where zoom_level=? and tile_column=? and tile_row=?').get(zoom, column, tileRow);
    return rec?.n ?? 0;
  } finally {
    db.close();
  }
}

function parse(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected ${arg}`);
    const eq = arg.indexOf('=');
    if (eq > 2) out[arg.slice(2, eq)] = arg.slice(eq + 1);
    else {
      out[arg.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}

function usage() {
  console.error('usage: node compare.mjs --source <source.mbtiles> --overview <overview.mbtiles> [--z 9 --x 164 --row 282]');
  process.exit(2);
}
