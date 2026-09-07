import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerp } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POLAR_WARNING =
  'Polar quality dominates model choice — this is a generic cruising polar, not a measured Sisu polar.';

function polarDirs() {
  const out = [];
  if (process.env.SISU_POLAR_DIR) out.push(process.env.SISU_POLAR_DIR);
  out.push(path.join(HERE, '..', 'polar'));
  out.push(path.join(HERE, '..', '..', 'polar'));
  return out;
}

export function polarDir() {
  return polarDirs().find((d) => {
    try {
      return fs.statSync(d).isDirectory();
    } catch {
      return false;
    }
  }) || polarDirs()[0];
}

function parseMatrix(text) {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (rows.length < 3) throw new Error('polar CSV too short');
  const header = rows[0].split(',').map((s) => s.trim());
  const tws = header.slice(1).map(Number);
  if (tws.some((n) => !Number.isFinite(n))) throw new Error('polar TWS header invalid');
  const twa = [];
  const bsp = [];
  for (const line of rows.slice(1)) {
    const cols = line.split(',').map((s) => s.trim());
    const a = Number(cols[0]);
    if (!Number.isFinite(a)) continue;
    twa.push(a);
    bsp.push(cols.slice(1).map(Number));
  }
  return { tws, twa, bsp };
}

export function listPolars() {
  const dir = polarDir();
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.csv'));
  } catch {
    names = [];
  }
  return names.map((n) => ({
    id: n.replace(/\.csv$/i, ''),
    file: n,
    warning: POLAR_WARNING,
  }));
}

const cache = new Map();

export function loadPolar(id = 'generic-cruising') {
  const safe = String(id || 'generic-cruising').replace(/[^A-Za-z0-9._-]/g, '');
  const dir = polarDir();
  const file = path.join(dir, `${safe}.csv`);
  const hit = cache.get(file);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    throw new Error(`polar not found: ${safe}`);
  }
  if (hit && hit.mtime === stat.mtimeMs) return hit.polar;
  const matrix = parseMatrix(fs.readFileSync(file, 'utf8'));
  const polar = {
    id: safe,
    file,
    warning: POLAR_WARNING,
    ...matrix,
    bsp(twaDeg, twsKn) {
      return lookup(matrix, twaDeg, twsKn);
    },
  };
  cache.set(file, { mtime: stat.mtimeMs, polar });
  return polar;
}

function lookup(matrix, twaDeg, twsKn) {
  const twa = Math.max(0, Math.min(180, twaDeg));
  const tws = Math.max(0, twsKn);
  const { twa: as, tws: ws, bsp } = matrix;
  let i0 = 0;
  for (let i = 0; i < as.length - 1; i++) {
    if (twa >= as[i]) i0 = i;
  }
  const i1 = Math.min(as.length - 1, i0 + 1);
  let j0 = 0;
  for (let j = 0; j < ws.length - 1; j++) {
    if (tws >= ws[j]) j0 = j;
  }
  const j1 = Math.min(ws.length - 1, j0 + 1);
  const ft = i0 === i1 ? 0 : (twa - as[i0]) / (as[i1] - as[i0]);
  const fs = j0 === j1 ? 0 : (tws - ws[j0]) / Math.max(1e-6, ws[j1] - ws[j0]);
  const a = lerp(bsp[i0][j0], bsp[i1][j0], ft);
  const b = lerp(bsp[i0][j1], bsp[i1][j1], ft);
  const v = lerp(a, b, fs);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

export { POLAR_WARNING };
