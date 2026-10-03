/**
 * USB / Finder drop-in of chart archives the operator already has (#108).
 * No Navionics/C-MAP decoder. Inbox is a mounted host folder so Mac can
 * point at a small test dir and F8 at the full circumnavigation dump.
 */
import fs from 'node:fs';
import path from 'node:path';
import { openMbtiles, peekMbtiles } from './mbtiles.mjs';
import { isProbablyPbf, isProbablyTile } from './fetchers/http.mjs';

const TILES = process.env.SISU_TILES_DIR || '/data/tiles';
const INBOX = process.env.SISU_IMPORT_DIR || path.join(TILES, 'inbox');
const MANUAL = path.join(TILES, 'manual');
const HOST = process.env.SISU_NAV_HOST || 'mac';
const WARN_BYTES = Number(process.env.SISU_IMPORT_WARN_BYTES || (HOST === 'f8' ? 0 : 32 * 1024 * 1024 * 1024));

const KINDS = new Set(['nautical', 'satellite', 'bathymetry']);

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Known product words beat the drawer's single kind, so a mixed folder stays honest. */
export function inferKind(name, fallback) {
  const s = String(name || '').toLowerCase();
  if (/arcgis|bingsat|googlesat|\bsatellite\b|\besri\b|\bbing\b|\bgoogle\b/.test(s)) return 'satellite';
  if (/bathy|gebco|bluetopo|\bdepth\b/.test(s)) return 'bathymetry';
  if (/navionics|c-?map|cm93|garmin|\bnoaa\b|\benc\b/.test(s)) return 'nautical';
  return KINDS.has(fallback) ? fallback : 'nautical';
}

function slugify(s) {
  return (
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'chart'
  );
}

export function inboxRoot() {
  return path.resolve(INBOX);
}

function safeJoin(root, rel) {
  const base = path.resolve(root);
  const full = path.resolve(base, rel || '.');
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (full !== base && !full.startsWith(prefix)) throw httpError(400, 'path escapes inbox');
  return full;
}

function isXyzDir(dir) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  return ents.some((e) => e.isDirectory() && /^\d{1,2}$/.test(e.name));
}

function dirSize(dir, cap = 0) {
  let n = 0;
  const walk = (d) => {
    let ents;
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        try {
          n += fs.statSync(p).size;
        } catch {
          /* */
        }
      }
      if (cap && n > cap) return;
    }
  };
  walk(dir);
  return n;
}

export function importStatus() {
  const root = inboxRoot();
  return {
    host: HOST,
    inboxMounted: fs.existsSync(root),
    inboxPath: root,
    warnBytes: WARN_BYTES || null,
    warnLabel: WARN_BYTES ? `${Math.round(WARN_BYTES / (1024 * 1024 * 1024))} GB` : null,
  };
}

export function listInbox(rel = '.') {
  const root = inboxRoot();
  if (!fs.existsSync(root)) {
    return { ...importStatus(), dir: '.', entries: [], dirs: [] };
  }
  const dir = safeJoin(root, rel);
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    throw httpError(404, 'inbox folder not found');
  }
  const dirs = [];
  const entries = [];
  for (const e of ents) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    const relPath = path.relative(root, full).split(path.sep).join('/');
    if (e.isDirectory()) {
      dirs.push({ name: e.name, relPath, xyz: isXyzDir(full) });
      if (isXyzDir(full)) {
        const bytes = dirSize(full, WARN_BYTES || 8 * 1024 * 1024 * 1024);
        entries.push({
          name: e.name,
          relPath,
          type: 'xyz',
          bytes,
          kindGuess: inferKind(e.name, 'nautical'),
        });
      }
      continue;
    }
    if (!/\.(mbtiles|pmtiles)$/i.test(e.name)) continue;
    let bytes = 0;
    try {
      bytes = fs.statSync(full).size;
    } catch {
      /* */
    }
    const peek = /\.mbtiles$/i.test(e.name) ? peekMbtiles(full) : null;
    entries.push({
      name: e.name,
      relPath,
      type: path.extname(e.name).slice(1).toLowerCase(),
      bytes,
      kindGuess: inferKind(e.name, 'nautical'),
      peek,
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  return { ...importStatus(), dir: path.relative(root, dir).split(path.sep).join('/') || '.', entries, dirs };
}

function readMetaFile(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  } catch {
    return null;
  }
}

export function listSets() {
  const out = [];
  let ents;
  try {
    ents = fs.readdirSync(MANUAL, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of ents) {
    if (!e.isDirectory()) continue;
    const dir = path.join(MANUAL, e.name);
    const meta = readMetaFile(dir);
    if (!meta) continue;
    const files = fs.readdirSync(dir).filter((n) => /\.(mbtiles|pmtiles)$/i.test(n));
    out.push({
      slug: e.name,
      label: meta.providerLabel || meta.label || e.name,
      kind: meta.kind || 'nautical',
      attribution: meta.attribution || '',
      notes: meta.notes || '',
      files,
      imported: true,
    });
  }
  return out;
}

function applyPeek(meta, peek) {
  if (!peek) return;
  if (peek.format) meta.format = peek.format;
  if (peek.tilesize) meta.tileSize = peek.tilesize;
  if (peek.minzoom != null) meta.minZoom = peek.minzoom;
  if (peek.maxzoom != null) meta.maxZoom = peek.maxzoom;
  if (peek.bounds) meta.bounds = peek.bounds;
}

function packXyz(srcDir, destFile, meta) {
  const zoomNames = fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => Number(e.name));
  if (zoomNames.length) {
    if (meta.minZoom == null) meta.minZoom = Math.min(...zoomNames);
    if (meta.maxZoom == null) meta.maxZoom = Math.max(...zoomNames);
  }
  const mb = openMbtiles(destFile, {
    name: meta.providerLabel || meta.provider,
    format: meta.format || 'png',
    bounds: meta.bounds || [-180, -85, 180, 85],
    minzoom: meta.minZoom ?? 0,
    maxzoom: meta.maxZoom ?? 18,
    attribution: meta.attribution || '',
    description: meta.notes || meta.providerLabel,
    tilesize: meta.tileSize || 256,
  });
  let fetched = 0;
  try {
    const zooms = fs.readdirSync(srcDir, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d+$/.test(e.name));
    for (const zent of zooms) {
      const z = Number(zent.name);
      const zdir = path.join(srcDir, zent.name);
      for (const xent of fs.readdirSync(zdir, { withFileTypes: true })) {
        if (!xent.isDirectory() || !/^\d+$/.test(xent.name)) continue;
        const x = Number(xent.name);
        const xdir = path.join(zdir, xent.name);
        for (const fn of fs.readdirSync(xdir)) {
          const m = fn.match(/^(\d+)\.(png|jpg|jpeg|webp|pbf)$/i);
          if (!m) continue;
          const y = Number(m[1]);
          const buf = fs.readFileSync(path.join(xdir, fn));
          if (!isProbablyTile(buf) && !isProbablyPbf(buf)) continue;
          if (mb.putTile(z, x, y, buf)) fetched += 1;
        }
      }
    }
  } finally {
    mb.close();
  }
  return fetched;
}

const jobs = new Map();
let seq = 0;
let active = null;

function persistJob(job) {
  jobs.set(job.id, job);
}

export function listImportJobs() {
  return Array.from(jobs.values());
}

export function getImportJob(id) {
  return jobs.get(id) || null;
}

async function runJob(job) {
  job.status = 'running';
  persistJob(job);
  const root = inboxRoot();
  fs.mkdirSync(MANUAL, { recursive: true });
  try {
    for (const item of job.items) {
      const src = safeJoin(root, item.relPath);
      const slug = slugify(item.slug || path.basename(item.relPath, path.extname(item.relPath)));
      const kind = inferKind(`${slug} ${item.label || ''} ${item.relPath || ''}`, item.kind);
      const destDir = path.join(MANUAL, slug);
      fs.mkdirSync(destDir, { recursive: true });
      const st = fs.statSync(src);
      const meta = {
        provider: slug,
        providerLabel: item.label || slug,
        kind,
        format: item.format || (item.type === 'xyz' ? 'png' : path.extname(src).slice(1).replace('.', '')),
        tileSize: item.tileSize || 256,
        attribution:
          item.attribution ||
          'Imported by operator — not an official product in this app. Not for navigation unless the source chart is.',
        notes: item.notes || `Imported ${new Date().toISOString().slice(0, 10)}`,
        imported: true,
      };
      if (st.isDirectory()) {
        const destFile = path.join(destDir, `${slug}.mbtiles`);
        packXyz(src, destFile, meta);
      } else {
        const destFile = path.join(destDir, path.basename(src));
        await fs.promises.copyFile(src, destFile);
        const peek = /\.mbtiles$/i.test(src) ? peekMbtiles(destFile) : null;
        applyPeek(meta, peek);
      }
      if (meta.minZoom == null || meta.maxZoom == null) {
        const destMb = fs.readdirSync(destDir).find((n) => /\.mbtiles$/i.test(n));
        if (destMb) applyPeek(meta, peekMbtiles(path.join(destDir, destMb)));
      }
      fs.writeFileSync(path.join(destDir, 'meta.json'), JSON.stringify(meta, null, 2));
      job.completed += 1;
      job.updatedAt = new Date().toISOString();
      persistJob(job);
    }
    job.status = 'done';
  } catch (err) {
    job.status = 'error';
    job.error = err instanceof Error ? err.message : String(err);
  }
  job.updatedAt = new Date().toISOString();
  persistJob(job);
}

function pump() {
  if (active) return;
  const next = Array.from(jobs.values()).find((j) => j.status === 'queued');
  if (!next) return;
  active = next.id;
  runJob(next).finally(() => {
    active = null;
    pump();
  });
}

function itemFrom(entry, slugName) {
  const base = slugName || String(entry.name || '').replace(/\.(mbtiles|pmtiles)$/i, '');
  const slug = slugify(base);
  const label = entry.peek?.name || base;
  return {
    relPath: entry.relPath,
    slug,
    kind: inferKind(`${slug} ${label} ${entry.relPath || ''}`, entry.kindGuess),
    label,
    type: entry.type,
    bytes: entry.bytes,
  };
}

/** Archives in this folder, plus one level of zone folders. Kind comes from the name. */
export function itemsInFolder(rel, fallback) {
  const listing = listInbox(rel || '.');
  const items = listing.entries.map((e) => itemFrom(e));
  for (const d of listing.dirs) {
    if (d.xyz) continue;
    let nested;
    try {
      nested = listInbox(d.relPath);
    } catch {
      continue;
    }
    for (const e of nested.entries) {
      if (e.type === 'xyz') continue;
      items.push(itemFrom(e, d.name));
    }
  }
  if (fallback) {
    for (const it of items) it.kind = inferKind(`${it.slug} ${it.label} ${it.relPath}`, fallback);
  }
  return items;
}

export function startImport({ dir, items, force, all, kind }) {
  const resolved = all ? itemsInFolder(dir || '.', kind) : items;
  if (!Array.isArray(resolved) || !resolved.length) {
    throw httpError(400, all ? 'no archives in this folder or its zone folders' : 'select at least one file or XYZ folder');
  }
  const bytes = resolved.reduce((n, it) => n + (Number(it.bytes) || 0), 0);
  const job = {
    id: `imp${Date.now().toString(36)}${++seq}`,
    status: 'queued',
    dir: dir || '.',
    items: resolved.map((it) => ({
      relPath: it.relPath,
      slug: it.slug,
      kind: it.kind,
      label: it.label,
      notes: it.notes,
      attribution: it.attribution,
      type: it.type,
      bytes: it.bytes,
      tileSize: it.tileSize,
      format: it.format,
    })),
    total: resolved.length,
    completed: 0,
    bytes,
    warn: Boolean(WARN_BYTES && bytes > WARN_BYTES && !force),
    host: HOST,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  };
  if (job.warn) {
    job.status = 'need-confirm';
    job.error = `Selected ~${Math.round(bytes / (1024 * 1024 * 1024))} GB. Fine on F8; heavy for this Mac. Re-submit with force:true to proceed, or select a smaller subset to test.`;
    persistJob(job);
    const err = httpError(413, job.error);
    err.job = job;
    throw err;
  }
  persistJob(job);
  pump();
  return job;
}
