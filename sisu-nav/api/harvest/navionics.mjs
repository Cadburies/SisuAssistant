/**
 * Convert a Navionics folder the operator already has into tiles/manual/.
 *
 * The directory name is the chart layer. T08 and MBM are both .nv2.
 *
 *   T08  .nv2  SonarChart      navionics-sonarchart-YYYY-MM   recorded, not drawn
 *   T32  .s57  S-57 ENC        navionics-s57-YYYY-MM          recorded, not drawn
 *   MBM  .nv2  Nautical Chart  navionics-nautical-YYYY-MM     recorded, not drawn
 *   lsc  .lsd  Live Sonar      navionics-live-sonar-YYYY-MM   zoom-15 PNG
 *
 * .lsd names look like N1353_W6697.lsd (N13°53', W66°97'). Each file is one
 * zoom-15 PNG: a colored grid from the file bytes, not a finished sonar image.
 * A .lsd or .s57 file outside those folders still belongs to its layer, because
 * the extension is unique. A .nv2 file outside T08 and MBM is skipped.
 *
 * Ported from the boat's existing converter. No canvas, no sql.js.
 * putTile() takes XYZ y and stores TMS itself.
 */
import fs from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { openMbtiles, peekMbtiles } from './mbtiles.mjs';

const SONAR_ZOOM = 15;
const TILE = 256;
const LAYOUT_CHILD = new Set(['lsc', 'mbm', 't08', 't32']);
const NAV_FILE = /\.(lsd|nv2|s57)$/i;

/** @type {const} */
const LAYERS = [
  {
    id: 'sonarchart',
    dir: 't08',
    ext: '.nv2',
    label: 'SonarChart',
    drawn: false,
    attribution: 'Navionics SonarChart. Not for primary navigation.',
    notes: (n) => `Accepted ${n} .nv2 files from T08. The SonarChart picture is not drawn.`,
  },
  {
    id: 's57',
    dir: 't32',
    ext: '.s57',
    label: 'S-57 ENC',
    drawn: false,
    attribution: 'Navionics S-57. Not for primary navigation.',
    notes: (n) => `Accepted ${n} .s57 files. The S-57 chart is not drawn.`,
  },
  {
    id: 'nautical',
    dir: 'mbm',
    ext: '.nv2',
    label: 'Nautical Chart',
    drawn: false,
    attribution: 'Navionics. Not for primary navigation.',
    notes: (n) => `Accepted ${n} .nv2 files from MBM. The nautical chart is not drawn.`,
  },
  {
    id: 'live-sonar',
    dir: 'lsc',
    ext: '.lsd',
    label: 'Live Sonar',
    drawn: true,
    attribution: 'Navionics Sonar Chart Live. Not for primary navigation.',
    notes: (n, tiles) =>
      `Converted from ${n} .lsd files. ${tiles} tiles in the archive. Colored grid from the file bytes, not a finished sonar image.`,
  },
];

const BY_DIR = new Map(LAYERS.map((layer) => [layer.dir, layer]));
const BY_ID = new Map(LAYERS.map((layer) => [layer.id, layer]));

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const tag = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])), 0);
  return Buffer.concat([len, tag, data, crc]);
}

function putPx(buf, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
  const i = (y * TILE + x) * 3;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
}

function fillRect(buf, x, y, w, h, r, g, b) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) putPx(buf, xx, yy, r, g, b);
  }
}

/** RGB PNG. Matches the old canvas tile: #0a1628 water, depth cells, 2px edge. */
export function createSonarPng(lsdData) {
  const px = Buffer.alloc(TILE * TILE * 3, 0);
  for (let i = 0; i < px.length; i += 3) {
    px[i] = 10;
    px[i + 1] = 22;
    px[i + 2] = 40;
  }
  if (lsdData.length >= 8) {
    const header = 16;
    let n = 0;
    for (let i = header; i + 7 < lsdData.length; i += 8) {
      const val1 = lsdData.readUInt32LE(i);
      const depth = (val1 & 0xffff) / 65535;
      const r = Math.floor(100 + depth * 50);
      const g = Math.floor(150 + depth * 50);
      const b = Math.floor(200 + (1 - depth) * 55);
      const x = (n % 32) * 8 + 4;
      const y = Math.floor(n / 32) * 8 + 4;
      fillRect(px, x, y, 4, 4, r, g, b);
      n += 1;
    }
    for (let i = 0; i < TILE; i++) {
      for (let t = 0; t < 2; t++) {
        putPx(px, i, t, 42, 74, 106);
        putPx(px, i, TILE - 1 - t, 42, 74, 106);
        putPx(px, t, i, 42, 74, 106);
        putPx(px, TILE - 1 - t, i, 42, 74, 106);
      }
    }
  }
  const raw = Buffer.alloc(TILE * (1 + TILE * 3));
  for (let y = 0; y < TILE; y++) {
    const dest = y * (1 + TILE * 3);
    raw[dest] = 0;
    px.copy(raw, dest + 1, y * TILE * 3, (y + 1) * TILE * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(TILE, 0);
  ihdr.writeUInt32BE(TILE, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

export function parseLsdFilename(filename) {
  const match = String(filename).match(/(N|S)(\d{2})(\d{2})_(E|W)(\d{2})(\d{2})\.lsd$/i);
  if (!match) return null;
  const lat = (Number(match[2]) + Number(match[3]) / 60) * (match[1].toUpperCase() === 'S' ? -1 : 1);
  const lon = (Number(match[5]) + Number(match[6]) / 60) * (match[4].toUpperCase() === 'W' ? -1 : 1);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function latLonToTile(lat, lon, zoom) {
  const latClamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const latRad = (latClamped * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.min(n - 1, Math.max(0, Math.floor(((lon + 180) / 360) * n)));
  const y = Math.min(
    n - 1,
    Math.max(0, Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)),
  );
  return { x, y };
}

function tileBounds(z, x, y) {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const south = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return [west, south, east, north];
}

function unionBounds(bounds, z, x, y) {
  const b = tileBounds(z, x, y);
  if (!bounds) return b;
  return [Math.min(bounds[0], b[0]), Math.min(bounds[1], b[1]), Math.max(bounds[2], b[2]), Math.max(bounds[3], b[3])];
}

function hasDirectNavFiles(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return false;
  }
  return names.some((n) => NAV_FILE.test(n));
}

/** True when this folder is a Navionics drop: chart files here, or one level down (lsc, MBM, T08, T32). */
export function isNavionicsRoot(dir) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of ents) {
    if (e.isSymbolicLink()) continue;
    if (e.isFile() && NAV_FILE.test(e.name)) return true;
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    if (LAYOUT_CHILD.has(e.name.toLowerCase())) return true;
    if (hasDirectNavFiles(path.join(dir, e.name))) return true;
  }
  return false;
}

/** A child the parent Navionics folder already covers, so import does not convert it twice. */
export function isNavionicsPiece(dir) {
  if (LAYOUT_CHILD.has(path.basename(dir).toLowerCase())) return true;
  return isNavionicsRoot(dir);
}

export function navionicsSummary(dir) {
  if (!isNavionicsRoot(dir)) return null;
  let files = 0;
  const walk = (d, depth) => {
    if (depth > 8 || files >= 200000) return;
    let ents;
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(path.join(d, e.name), depth + 1);
      else if (NAV_FILE.test(e.name)) files += 1;
    }
  };
  walk(dir, 0);
  return files ? { files } : null;
}

/**
 * Deepest T08 / T32 / MBM / lsc directory on the path, else the folder the
 * operator selected when that folder itself is one of those layers.
 */
function layerFromPath(srcBase, ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const hit = BY_DIR.get(ancestors[i]);
    if (hit) return hit;
  }
  return BY_DIR.get(srcBase) || null;
}

function classify(srcDir) {
  const srcBase = path.basename(srcDir).toLowerCase();
  const buckets = new Map(LAYERS.map((layer) => [layer.id, []]));
  let skippedNv2 = 0;
  const walk = (dir, ancestors, depth) => {
    if (depth > 8) return;
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, ancestors.concat(e.name.toLowerCase()), depth + 1);
        continue;
      }
      const ext = path.extname(e.name).toLowerCase();
      if (ext !== '.lsd' && ext !== '.nv2' && ext !== '.s57') continue;
      const layer = layerFromPath(srcBase, ancestors);
      if (layer && ext === layer.ext) {
        buckets.get(layer.id).push(full);
        continue;
      }
      if (ext === '.lsd') buckets.get('live-sonar').push(full);
      else if (ext === '.s57') buckets.get('s57').push(full);
      else skippedNv2 += 1;
    }
  };
  walk(srcDir, [], 0);
  return { buckets, skippedNv2 };
}

function yearMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function layerSlug(layer, ym) {
  return `navionics-${layer.id}-${ym}`;
}

function writeMeta(dir, meta) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
}

async function breathe(n) {
  if (n % 40 === 0) await new Promise((resolve) => setImmediate(resolve));
}

function openCount(file) {
  const mb = openMbtiles(file);
  try {
    return mb.countAll();
  } finally {
    mb.close();
  }
}

function recordedMeta(layer, slug, ym, fileCount) {
  return {
    provider: slug,
    providerLabel: `Navionics ${layer.label} · ${ym}`,
    label: `Navionics ${layer.label} · ${ym}`,
    kind: 'nautical',
    format: 'png',
    tileSize: 256,
    sourceDate: ym,
    attribution: layer.attribution,
    notes: layer.notes(fileCount),
    imported: true,
  };
}

/** Empty archive plus meta. No bounds, so the set does not cover every view. */
function ensureRecorded(layer, files, manualDir, ym) {
  if (!files.length) return null;
  const slug = layerSlug(layer, ym);
  const slugDir = path.join(manualDir, slug);
  const mbtilesPath = path.join(slugDir, `${slug}.mbtiles`);
  const metaPath = path.join(slugDir, 'meta.json');
  if (fs.existsSync(metaPath) && fs.existsSync(mbtilesPath)) return slug;
  fs.mkdirSync(slugDir, { recursive: true });
  if (!fs.existsSync(mbtilesPath)) {
    const mb = openMbtiles(mbtilesPath, {
      name: `Navionics ${layer.label}`,
      format: 'png',
      attribution: layer.attribution,
      description: layer.notes(files.length),
      tilesize: 256,
    });
    mb.close();
  }
  if (!fs.existsSync(metaPath)) writeMeta(slugDir, recordedMeta(layer, slug, ym, files.length));
  return slug;
}

async function convertLiveSonar(files, manualDir, ym) {
  const layer = BY_ID.get('live-sonar');
  const items = [];
  let skippedLsd = 0;
  for (const file of files) {
    const coords = parseLsdFilename(path.basename(file));
    if (!coords) {
      skippedLsd += 1;
      continue;
    }
    items.push({ file, coords, tile: latLonToTile(coords.lat, coords.lon, SONAR_ZOOM) });
  }
  if (!items.length) return { slug: null, skippedLsd };

  const slug = layerSlug(layer, ym);
  const slugDir = path.join(manualDir, slug);
  const mbtilesPath = path.join(slugDir, `${slug}.mbtiles`);
  const unique = new Map();
  let bounds = null;
  for (const item of items) {
    const key = `${item.tile.x},${item.tile.y}`;
    if (!unique.has(key)) unique.set(key, item);
    bounds = unionBounds(bounds, SONAR_ZOOM, item.tile.x, item.tile.y);
  }
  fs.mkdirSync(slugDir, { recursive: true });
  const mb = openMbtiles(mbtilesPath, {
    name: 'Navionics Live Sonar',
    format: 'png',
    bounds,
    // One zoom only. MapLibre scales this tile; a wider range makes it
    // request zooms that were never written.
    minzoom: SONAR_ZOOM,
    maxzoom: SONAR_ZOOM,
    attribution: layer.attribution,
    description: `Navionics Live Sonar. ${items.length} .lsd files.`,
    tilesize: 256,
  });
  try {
    let n = 0;
    let batch = [];
    const flush = () => {
      if (!batch.length) return;
      const rows = batch;
      batch = [];
      mb.transaction(() => {
        for (const row of rows) mb.putTile(row.z, row.x, row.y, row.png);
      });
    };
    for (const item of unique.values()) {
      if (mb.hasTile(SONAR_ZOOM, item.tile.x, item.tile.y)) continue;
      batch.push({
        z: SONAR_ZOOM,
        x: item.tile.x,
        y: item.tile.y,
        png: createSonarPng(fs.readFileSync(item.file)),
      });
      n += 1;
      if (batch.length >= 40) {
        flush();
        await breathe(n);
      }
    }
    flush();
  } finally {
    mb.close();
  }
  const tileCount = openCount(mbtilesPath);
  // meta.json wins over the archive in the chart list. The archive bounds
  // are the union, including tiles stored by an earlier run this month.
  const storedBounds = peekMbtiles(mbtilesPath)?.bounds;
  const boundsOut = Array.isArray(storedBounds) && storedBounds.length === 4 ? storedBounds : bounds;
  writeMeta(slugDir, {
    provider: slug,
    providerLabel: `Navionics ${layer.label} · ${ym}`,
    label: `Navionics ${layer.label} · ${ym}`,
    kind: 'nautical',
    format: 'png',
    tileSize: 256,
    minZoom: SONAR_ZOOM,
    maxZoom: SONAR_ZOOM,
    bounds: boundsOut,
    sourceDate: ym,
    attribution: layer.attribution,
    notes: layer.notes(items.length, tileCount),
    imported: true,
  });
  return { slug, skippedLsd };
}

/**
 * One set per chart layer that has files. `manualDir` is tiles/manual.
 * Live Sonar is the only set with PNG tiles.
 */
export async function convertNavionics(srcDir, manualDir) {
  const { buckets, skippedNv2 } = classify(srcDir);
  const ym = yearMonth();
  const slugs = [];
  for (const layer of LAYERS) {
    if (layer.drawn) continue;
    const slug = ensureRecorded(layer, buckets.get(layer.id), manualDir, ym);
    if (slug) slugs.push(slug);
  }
  const live = await convertLiveSonar(buckets.get('live-sonar'), manualDir, ym);
  if (live.slug) slugs.push(live.slug);
  return { slugs, skippedLsd: live.skippedLsd, skippedNv2 };
}

const invoked =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invoked) {
  const src = process.argv[2];
  const manual = process.argv[3];
  if (!src || !manual) {
    console.error('Usage: node navionics.mjs <src-dir> <manual-dir>');
    process.exit(1);
  }
  convertNavionics(src, manual)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
