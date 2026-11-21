#!/usr/bin/env node
/**
 * Build a z0-8 generalized overview from a Poseidon MBTiles export (#256).
 *
 * The source export repeats full-detail features at every zoom. This tool
 * reads the z9 tiles (read-only), drops overlays that are not drawn at
 * overview zooms, simplifies geometry, and merges each four-tile quadtree
 * parent into z8, then z7 ... z0. The source archive and its z9+ handoff are
 * untouched. Output is a separate MBTiles directory with its own metadata,
 * style, sprite, coverage and archive.
 *
 * Node >=24 (node:sqlite). Run `npm ci` in this directory first.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { fromGeojsonVt } from '@maplibre/vt-pbf';
import polygonClipping from 'polygon-clipping';

const EXTENT = 4096;
const Z9 = 9;
const SOURCE_ZOOM = 9;
const DEFAULT_OUT_ZOOM = 8;

// Layers that are either text/point detail or a map-block mesh. They are not
// part of the world/coastal generalization; the source keeps them at z9+.
const DROP_LAYERS = new Set([
  'base_line', 'labels', 'poi', 'places', 'soundg', 'lightsec', 'sonar',
  'rockpts', 'points', 'roaedg', 'rivers', 'canals', 'bridge', 'cblohd', 'pipohd', 'pipsol',
]);

// At z0 the source's full-detail contours/shorelines are hundreds of MB of
// fragments. Keep the world fills and major hazards; z1+ keeps the lines.
const Z0_DROP = new Set(['depcnt', 'slcons', 'unknown']);
const LOW_DROP = new Set(['resare', 'cblsub', 'rectrc', 'uwtroc', 'achare', 'depare']);
const DISSOLVE = new Set(['lndare', 'base_area']);

const BUNDLE_FILES = [
  'style.json', 'style-colors.json', 'sprite.json', 'sprite.png',
  'coverage.geojson', 'regions.geojson',
];

const args = parseArgs(process.argv.slice(2));
if (!args.source) usage('--source is required');
const sourcePath = path.resolve(args.source);
const sourceDir = path.dirname(sourcePath);
const sourceChart = args.chart || path.basename(sourcePath, '.mbtiles');
const chart = args.name || `${sourceChart}-overview`;
const outDir = path.resolve(args.out || path.join(sourceDir, chart));
const maxzoom = integer(args.maxzoom, DEFAULT_OUT_ZOOM, 0, 8, '--maxzoom');
const simplifyPx = number(args.simplify, 1, 0, 64, '--simplify');
const minLinePx = number(args['min-line'], 1, 0, 4096, '--min-line');
const minAreaPx = number(args['min-area'], 1, 0, 4096, '--min-area');
const bbox = args.bbox ? parseBbox(args.bbox) : null;
const dryRun = Boolean(args['dry-run']);
const perTile = Boolean(args['per-tile']);

if (!fs.existsSync(sourcePath)) throw new Error(`source archive not found: ${sourcePath}`);
if (!dryRun && fs.existsSync(outDir) && !args.force) {
  throw new Error(`${outDir} exists; pass --force to replace it`);
}
if (!dryRun) fs.mkdirSync(outDir, { recursive: true });
const archivePath = path.join(outDir, `${chart}.mbtiles`);
const tempArchive = `${archivePath}.tmp`;

const source = new DatabaseSync(sourcePath, { readOnly: true });
const sourceMeta = readMetadata(source);
const style = readJson(path.join(sourceDir, 'style.json'), { layers: [] });
const layerMinzoom = layerGates(style);
const allowedAtSource = new Set(
  Object.keys(layerMinzoom).filter((name) => layerMinzoom[name] <= maxzoom && !DROP_LAYERS.has(name)),
);
// A style may refer to a source-layer that the metadata does not list. Keep
// those too; the generated metadata below lists only layers actually written.
for (const name of Object.keys(sourceMeta.vectorLayers || {})) {
  if (layerMinzoom[name] <= maxzoom && !DROP_LAYERS.has(name)) allowedAtSource.add(name);
}

log(`source ${sourceChart} -> ${chart} (z0-${maxzoom})`);
log(`layers: ${[...allowedAtSource].sort().join(', ')}`);
if (bbox) log(`bbox ${bbox.join(',')}`);

const sourceTiles = source.prepare(`
  select tile_column, tile_row, tile_data
  from tiles where zoom_level = ?
  order by (tile_column / 2), ((511 - tile_row) / 2), tile_column, tile_row
`);

if (dryRun) {
  let tiles = 0;
  let bytes = 0;
  let features = 0;
  for (const row of sourceTiles.iterate(SOURCE_ZOOM)) {
    tiles++;
    bytes += row.tile_data.byteLength;
    const filtered = filterLayers(new Uint8Array(row.tile_data), allowedAtSource);
    if (!filtered) continue;
    const tile = new VectorTile(new PbfReader(filtered));
    for (const layer of Object.values(tile.layers)) features += layer.length;
  }
  log(JSON.stringify({ tiles, bytes, features, layers: allowedAtSource.size }));
  process.exit(0);
}

if (fs.existsSync(tempArchive)) fs.rmSync(tempArchive);
const out = new DatabaseSync(tempArchive);
out.exec(`
  create table metadata (name text, value text);
  create table tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);
  create unique index tile_index on tiles (zoom_level, tile_column, tile_row);
`);
const insertTile = out.prepare('insert into tiles (zoom_level, tile_column, tile_row, tile_data) values (?, ?, ?, ?)');
out.exec('begin');

if (perTile) {
  // Source z0-8 tiles already carry the same detail at each zoom. Filter,
  // simplify and re-encode them in place; leave z9 as the source handoff.
  for (let z = 0; z <= maxzoom; z++) {
    const rows = source.prepare(`
      select tile_column, tile_row, tile_data from tiles where zoom_level = ?
      order by tile_column, tile_row
    `).all(z);
    const allowed = new Set([...allowedAtSource].filter((name) => layerMinzoom[name] <= z && !(z === 0 && Z0_DROP.has(name)) && !(z <= 2 && LOW_DROP.has(name))));
    let seen = 0;
    for (const row of rows) {
      const x = Number(row.tile_column);
      const yTop = (2 ** z) - 1 - Number(row.tile_row);
      if (bbox && !tileIntersects(z, x, yTop, bbox)) continue;
      const filtered = filterLayers(new Uint8Array(row.tile_data), allowed);
      seen++;
      if (!filtered) continue;
      const tile = new VectorTile(new PbfReader(filtered));
      const layers = new Map();
      addSourceFeatures(layers, tile, z, x, yTop, allowed, layerMinzoom);
      writeLevelTile(out, insertTile, z, x, yTop, layers, maxzoom);
      if (seen % 250 === 0) log(`z${z}: ${seen}/${rows.length}`);
    }
    log(`z${z}: wrote ${seen} source tiles`);
  }
} else {
  let sourceTilesSeen = 0;
  let openKey = '';
  let open = null;
  const flushParent = () => {
    if (!open) return;
    writeLevelTile(out, insertTile, 8, open.x, open.y, open.layers, maxzoom);
    open = null;
  };
  for (const row of sourceTiles.iterate(SOURCE_ZOOM)) {
    const x = Number(row.tile_column);
    const yTop = (2 ** SOURCE_ZOOM) - 1 - Number(row.tile_row);
    if (bbox && !tileIntersects(SOURCE_ZOOM, x, yTop, bbox)) continue;
    const key = `${x >> 1}/${yTop >> 1}`;
    if (key !== openKey) {
      flushParent();
      openKey = key;
      open = { x: x >> 1, y: yTop >> 1, layers: new Map() };
    }
    const raw = new Uint8Array(row.tile_data);
    const filtered = filterLayers(raw, allowedAtSource);
    sourceTilesSeen++;
    if (!filtered) continue;
    const tile = new VectorTile(new PbfReader(filtered));
    addSourceFeatures(open.layers, tile, SOURCE_ZOOM, x, yTop, allowedAtSource, layerMinzoom);
    if (sourceTilesSeen % 500 === 0) log(`read ${sourceTilesSeen} z9 tiles`);
  }
  flushParent();

  log(`read ${sourceTilesSeen} z9 tiles; z8 written`);
  // Disk-based pyramid: read four child tiles from the output archive, build
  // the parent, write it, and release everything. No level-wide feature map.
  const levelRows = out.prepare('select tile_column, tile_row from tiles where zoom_level = ?');
  const levelTile = out.prepare('select tile_data from tiles where zoom_level = ? and tile_column = ? and tile_row = ?');
  for (let level = 7; level >= 0; level--) {
    const childLevel = level + 1;
    const grouped = new Map();
    for (const row of levelRows.all(childLevel)) {
      const x = Number(row.tile_column);
      const yTop = (2 ** childLevel) - 1 - Number(row.tile_row);
      const px = x >> 1;
      const py = yTop >> 1;
      const key = `${px}/${py}`;
      let group = grouped.get(key);
      if (!group) {
        group = { x: px, y: py, children: [] };
        grouped.set(key, group);
      }
      group.children.push([x, Number(row.tile_row)]);
    }
    log(`build z${level}: ${grouped.size} parents`);
    for (const group of grouped.values()) {
      const layers = new Map();
      for (const [x, row] of group.children) {
        const rec = levelTile.get(childLevel, x, row);
        if (!rec) continue;
        const decoded = decodeOutputTile(rec.tile_data, childLevel, x, 2 ** childLevel - 1 - row);
        mergeLayers(layers, decoded);
      }
      writeLevelTile(out, insertTile, level, group.x, group.y, layers, maxzoom);
    }
  }
}

out.exec('commit');
writeMetadata(out, chart, sourceChart, sourceMeta, maxzoom);
out.close();
fs.renameSync(tempArchive, archivePath);
copyBundle(sourceDir, outDir);
writeMetaJson(sourceDir, outDir, chart, sourceChart, maxzoom);
log(`wrote ${archivePath} (${fs.statSync(archivePath).size} bytes)`);
source.close();

// ---------------------------------------------------------------------------

function writeLevelTile(db, insert, z, x, y, layers, maxzoom) {
  const features = new Map();
  for (const [name, list] of layers) {
    const min = layerMinzoom[name];
    if (min > z || DROP_LAYERS.has(name) || (z === 0 && Z0_DROP.has(name)) || (z <= 2 && LOW_DROP.has(name)) || !allowedAtSource.has(name)) continue;
    let converted = [];
    const scale = 2 ** (maxzoom - z);
    const lineLimit = z <= 2 ? 0 : minLinePx * scale;
    const areaLimit = z <= 2 ? 0 : minAreaPx * scale * scale;
    for (const feature of list) {
      const local = toLocal(feature, z, x, y);
      if (!local) continue;
      converted.push(local);
    }
    if (z === 0 && DISSOLVE.has(name)) converted = dissolve(converted);
    const simplifiedFeatures = [];
    for (const feature of converted) {
      const simplified = simplifyFeature(feature, simplifyPx, lineLimit, areaLimit);
      if (simplified) simplifiedFeatures.push(simplified);
    }
    if (simplifiedFeatures.length) features.set(name, simplifiedFeatures);
  }
  if (!features.size) return new Map();
  const tileLayers = {};
  for (const [name, list] of features) tileLayers[name] = { features: list };
  const pbf = fromGeojsonVt(tileLayers, { version: 2, extent: EXTENT });
  const gz = zlib.gzipSync(Buffer.from(pbf), { level: 9 });
  insert.run(z, x, (2 ** z) - 1 - y, gz);
  if (z % 8 === 0 && x === 0 && y === 0) log(`z${z} tile ${gz.byteLength} bytes`);
  return new Map();
}

function decodeOutputTile(data, z, x, y) {
  let buf = new Uint8Array(data);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = new Uint8Array(zlib.gunzipSync(buf));
  const tile = new VectorTile(new PbfReader(buf));
  const layers = new Map();
  const scale = 2 ** z;
  for (const [name, layer] of Object.entries(tile.layers)) {
    if (!allowedAtSource.has(name) || DROP_LAYERS.has(name)) continue;
    const list = [];
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const props = feature.properties || {};
      if (feature.type === 1) {
        for (const ring of feature.loadGeometry()) {
          for (const p of ring) {
            list.push({
              id: feature.id,
              type: 1,
              geometry: [[(x + p.x / layer.extent) / scale, (y + p.y / layer.extent) / scale]],
              tags: props,
            });
          }
        }
      } else if (feature.type === 2) {
        for (const ring of feature.loadGeometry()) {
          const geometry = [ring.map((p) => [(x + p.x / layer.extent) / scale, (y + p.y / layer.extent) / scale])];
          if (geometry[0].length >= 2) list.push({ id: feature.id, type: 2, geometry, tags: props });
        }
      } else if (feature.type === 3) {
        const geometry = feature.loadGeometry().map((ring) => ring.map((p) => [(x + p.x / layer.extent) / scale, (y + p.y / layer.extent) / scale]));
        if (geometry.length) list.push({ id: feature.id, type: 3, geometry, tags: props });
      }
    }
    if (list.length) layers.set(name, list);
  }
  return layers;
}

function addSourceFeatures(layers, tile, z, x, y, allowed, gates) {
  const scale = 2 ** z;
  for (const [name, layer] of Object.entries(tile.layers)) {
    if (!allowed.has(name)) continue;
    const list = layers.get(name) || [];
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const props = feature.properties || {};
      if (feature.type === 1) {
        for (const ring of feature.loadGeometry()) {
          for (const p of ring) {
            list.push({
              id: feature.id,
              type: 1,
              geometry: [[(x + p.x / layer.extent) / scale, (y + p.y / layer.extent) / scale]],
              tags: props,
            });
          }
        }
      } else if (feature.type === 2) {
        for (const ring of feature.loadGeometry()) {
          const geometry = [ring.map((p) => [(x + p.x / layer.extent) / scale, (y + p.y / layer.extent) / scale])];
          if (geometry[0].length >= 2) list.push({ id: feature.id, type: 2, geometry, tags: props });
        }
      } else if (feature.type === 3) {
        const geo = feature.toGeoJSON(x, y, z).geometry;
        const polygons = geo.type === 'MultiPolygon' ? geo.coordinates : [geo.coordinates];
        for (const polygon of polygons) {
          const geometry = polygon.map((ring) => ring.map(([lon, lat]) => lngLatToNormalized(lon, lat)));
          if (geometry.length) list.push({ id: feature.id, type: 3, geometry, tags: props });
        }
      }
    }
    if (list.length) layers.set(name, list);
  }
}

function toLocal(feature, z, x, y) {
  const scale = 2 ** z;
  const convert = ([nx, ny]) => [(nx * scale - x) * EXTENT, (ny * scale - y) * EXTENT];
  if (feature.type === 1) return { ...feature, geometry: feature.geometry.map(convert) };
  if (feature.type === 2) return { ...feature, geometry: feature.geometry.map((ring) => ring.map(convert)) };
  if (feature.type === 3) return { ...feature, geometry: feature.geometry.map((ring) => ring.map(convert)) };
  return null;
}


function simplifyFeature(feature, tolerance, minLine, minArea) {
  if (feature.type === 1) return feature;
  if (feature.type === 2) {
    const rings = [];
    for (const ring of feature.geometry) {
      const simplified = rdp(ring, tolerance);
      if (simplified.length >= 2 && lineLength(simplified) >= minLine) rings.push(simplified);
    }
    if (!rings.length) return null;
    return { ...feature, geometry: rings };
  }
  if (feature.type === 3) {
    const rings = [];
    for (const ring of feature.geometry) {
      const simplified = rdp(ring, tolerance);
      if (simplified.length >= 3) {
        if (!samePoint(simplified[0], simplified[simplified.length - 1])) simplified.push(simplified[0]);
        rings.push(simplified);
      }
    }
    if (!rings.length || Math.abs(ringArea(rings[0])) < minArea) return null;
    return { ...feature, geometry: rings };
  }
  return null;
}

function rdp(points, tolerance) {
  if (points.length <= 2) return points.slice();
  const sq = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let index = -1;
    let max = sq;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegmentDistance(points[i], points[first], points[last]);
      if (d > max) {
        index = i;
        max = d;
      }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function sqSegmentDistance(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function lineLength(points) {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return n;
}

function ringArea(ring) {
  let n = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) n += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  return n / 2;
}

function samePoint(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function dissolve(features) {
  const polygons = features.filter((f) => f.type === 3 && f.geometry?.length).map((f) => f.geometry);
  if (!polygons.length) return features;
  let merged;
  try {
    merged = polygons[0];
    for (let i = 1; i < polygons.length; i += 200) {
      merged = polygonClipping.union(merged, ...polygons.slice(i, i + 200));
    }
  } catch {
    return features;
  }
  const tags = features[0].tags || {};
  return merged.map((polygon) => ({ id: undefined, type: 3, geometry: polygon, tags }));
}

function mergeLayers(target, source) {
  for (const [name, list] of source) {
    const existing = target.get(name);
    if (existing) {
      for (const feature of list) existing.push(feature);
    } else {
      target.set(name, list.slice());
    }
  }
}

function filterLayers(buf, allowed) {
  const pbf = new PbfReader(buf);
  const parts = [];
  while (pbf.pos < pbf.length) {
    const start = pbf.pos;
    const tag = pbf.readVarint();
    if (tag !== 26) {
      pbf.skip(tag & 7);
      continue;
    }
    const len = pbf.readVarint();
    const end = pbf.pos + len;
    const lp = new PbfReader(buf.subarray(pbf.pos, end));
    let name = '';
    while (lp.pos < lp.length) {
      const t = lp.readVarint();
      if (t === 10) {
        name = lp.readString();
        break;
      }
      lp.skip(t & 7);
    }
    pbf.pos = end;
    if (name && allowed.has(name)) parts.push(buf.subarray(start, end));
  }
  if (!parts.length) return null;
  let total = 0;
  for (const part of parts) total += part.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function layerGates(styleDoc) {
  const gates = {};
  for (const layer of styleDoc.layers || []) {
    const name = layer['source-layer'];
    if (!name) continue;
    const min = Number(layer.minzoom ?? 0);
    gates[name] = gates[name] === undefined ? min : Math.min(gates[name], min);
  }
  return gates;
}

function readMetadata(db) {
  const rows = db.prepare('select name, value from metadata').all();
  const meta = {};
  for (const row of rows) meta[row.name] = row.value;
  let vectorLayers = {};
  try {
    const json = JSON.parse(meta.json || '{}');
    for (const layer of json.vector_layers || []) vectorLayers[layer.id] = layer;
  } catch {
    vectorLayers = {};
  }
  meta.vectorLayers = vectorLayers;
  return meta;
}

function writeMetadata(db, chart, sourceChart, meta, maxzoom) {
  const layers = [];
  for (const [name, layer] of Object.entries(meta.vectorLayers)) {
    if (!allowedAtSource.has(name)) continue;
    layers.push({ ...layer, minzoom: 0, maxzoom });
  }
  const bounds = meta.bounds || '-180,-85,180,85';
  const values = {
    name: `${meta.name || sourceChart} overview`,
    description: `Generalized z0-${maxzoom} overview of ${sourceChart}. Source z9+ unchanged.`,
    format: 'pbf',
    type: 'overlay',
    version: '1',
    minzoom: '0',
    maxzoom: String(maxzoom),
    bounds,
    center: centerOf(bounds),
    attribution: meta.attribution || '',
    json: JSON.stringify({ vector_layers: layers }),
  };
  const insert = db.prepare('insert into metadata (name, value) values (?, ?)');
  for (const [name, value] of Object.entries(values)) insert.run(name, String(value));
}

function writeMetaJson(sourceDir, outDir, chart, sourceChart, maxzoom) {
  const source = readJson(path.join(sourceDir, 'meta.json'), {});
  const meta = {
    ...source,
    provider: chart,
    providerLabel: `${source.providerLabel || sourceChart} overview`,
    minZoom: 0,
    maxZoom: maxzoom,
    overviewOf: sourceChart,
    overview: true,
    version: source.version || '1',
  };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
}

function copyBundle(sourceDir, outDir) {
  for (const file of BUNDLE_FILES) {
    const from = path.join(sourceDir, file);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(outDir, file));
  }
}

function centerOf(bounds) {
  const [w, s, e, n] = String(bounds).split(',').map(Number);
  if ([w, s, e, n].some((n) => !Number.isFinite(n))) return '0,0,0';
  return `${(w + e) / 2},${(s + n) / 2},4`;
}

function tileIntersects(z, x, y, box) {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const south = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return west < box[2] && east > box[0] && south < box[3] && north > box[1];
}

function lngLatToNormalized(lon, lat) {
  const r = (lat * Math.PI) / 180;
  return [(lon + 180) / 360, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2];
}

function parseBbox(value) {
  const parts = String(value).split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) throw new Error('--bbox must be west,south,east,north');
  return parts;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const equal = arg.indexOf('=');
    if (equal > 2) {
      out[arg.slice(2, equal)] = arg.slice(equal + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function integer(value, fallback, min, max, name) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be ${min}..${max}`);
  return n;
}

function number(value, fallback, min, max, name) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name} must be ${min}..${max}`);
  return n;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function log(message) {
  process.stderr.write(`${message}\n`);
}

function usage(message) {
  if (message) process.stderr.write(`${message}\n`);
  process.stderr.write('usage: node generate.mjs --source <source.mbtiles> --out <dir> [--name poseidon-nav-overview] [--maxzoom 8] [--bbox w,s,e,n] [--force]\n');
  process.exit(2);
}
