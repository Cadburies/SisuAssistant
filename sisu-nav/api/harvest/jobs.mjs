/**
 * Harvest job orchestration: one dated output folder per provider/region/day
 * (never overwritten — a completed folder always gets a fresh one on re-run),
 * a single-worker in-process queue (no new compose service), and resumability
 * via a `progress.json` written into the output folder before/while tiles are
 * fetched. On boot, scanResumable() walks the tree once for interrupted runs
 * so a container restart doesn't orphan them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getProvider, isSecretConfigured } from './providers.mjs';
import { checkQuota } from './quota.mjs';
import { countTiles } from './grid.mjs';
import { runEox } from './fetchers/eox.mjs';
import { runGibs } from './fetchers/gibs.mjs';
import { runEsri } from './fetchers/esri.mjs';
import { runNoaaEnc } from './fetchers/noaa-enc.mjs';
import { runSecretGated } from './fetchers/secret-gated.mjs';

const TILES = process.env.SISU_TILES_DIR || '/data/tiles';

const RUNNERS = {
  eox: runEox,
  gibs: runGibs,
  esri: runEsri,
  'noaa-enc': runNoaaEnc,
  maptiler: runSecretGated,
  maxar: runSecretGated,
  planet: runSecretGated,
};

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function slug(s) {
  return (
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'region'
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function datedDir(kind, providerId, region, date) {
  return path.join(TILES, kind, providerId, slug(region), date);
}

function isComplete(dir) {
  return fs.existsSync(path.join(dir, 'meta.json'));
}

/** A fresh dated folder for today — bumps to `_2`, `_3`, ... if today's is already complete. Never overwrites a finished snapshot. */
function freshDatedDir(kind, providerId, region) {
  const date = todayIso();
  let dir = datedDir(kind, providerId, region, date);
  let n = 2;
  while (fs.existsSync(dir) && isComplete(dir)) {
    dir = datedDir(kind, providerId, region, `${date}_${n}`);
    n += 1;
  }
  return dir;
}

function readProgress(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'progress.json'), 'utf8'));
  } catch {
    return null;
  }
}

function writeProgress(dir, progress) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'progress.json'), JSON.stringify(progress, null, 2));
}

function writeMeta(dir, meta) {
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
}

function clampZoom(z, provider) {
  const lo = provider.minZoom ?? 0;
  const hi = provider.maxZoom ?? 18;
  const n = Number(z);
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : hi));
}

let seq = 0;
const jobsById = new Map();
const queue = [];
let activeId = null;

function makeJobId() {
  seq += 1;
  return `h${Date.now().toString(36)}${seq}`;
}

function publicJob(job) {
  return { ...job };
}

export function listJobs() {
  return Array.from(jobsById.values()).map(publicJob);
}

export function getJob(id) {
  const job = jobsById.get(id);
  return job ? publicJob(job) : null;
}

export function estimate({ providerId, bbox, minZoom, maxZoom }) {
  const provider = getProvider(providerId);
  if (!provider) throw httpError(404, `unknown provider: ${providerId}`);
  if (provider.harvestable === false) throw httpError(400, `${providerId} is not a harvest target`);
  validateBbox(bbox);
  const zMin = clampZoom(minZoom, provider);
  const zMax = clampZoom(maxZoom, provider);
  const tileCount = countTiles(bbox, zMin, zMax);
  const limitTiles = provider.exportLimitTiles ?? null;
  return {
    tileCount,
    minZoom: zMin,
    maxZoom: zMax,
    limitTiles,
    withinLimit: limitTiles == null || tileCount <= limitTiles,
    quota: checkQuota(TILES),
  };
}

function validateBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    throw httpError(400, 'bbox must be [west, south, east, north]');
  }
}

export function createJob({ providerId, region, bbox, minZoom, maxZoom, time, notes }) {
  const provider = getProvider(providerId);
  if (!provider) throw httpError(404, `unknown provider: ${providerId}`);
  if (provider.harvestable === false) throw httpError(400, `${providerId} is not a harvest target`);
  validateBbox(bbox);
  if (!isSecretConfigured(provider)) {
    throw httpError(412, `${providerId} requires ${provider.secretEnv} to be set — refusing to run without it`);
  }

  const zMin = clampZoom(minZoom, provider);
  const zMax = clampZoom(maxZoom, provider);
  const est = estimate({ providerId, bbox, minZoom: zMin, maxZoom: zMax });
  if (!est.withinLimit) {
    throw httpError(
      413,
      `estimated ${est.tileCount} tiles exceeds ${providerId}'s limit of ${est.limitTiles} — narrow the bbox or zoom range`,
    );
  }
  if (!est.quota.ok) {
    throw httpError(
      507,
      est.quota.overQuota
        ? 'harvest disk quota exceeded — free up sisu-nav/tiles/ before starting a new job'
        : 'volume is low on free disk space — refusing to start a new harvest job',
    );
  }

  const outDir = freshDatedDir(provider.kind, providerId, region);
  const id = makeJobId();
  const job = {
    id,
    providerId,
    providerLabel: provider.label,
    kind: provider.kind,
    region: region || 'region',
    bbox,
    minZoom: zMin,
    maxZoom: zMax,
    time: time || null,
    notes: notes || '',
    outDir: path.relative(TILES, outDir),
    status: 'queued',
    total: est.tileCount,
    completed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  };
  jobsById.set(id, job);
  writeProgress(outDir, job);
  queue.push(id);
  pump();
  return publicJob(job);
}

export function resumeJob(id) {
  const job = jobsById.get(id);
  if (!job) throw httpError(404, 'job not found');
  if (job.status === 'done') throw httpError(400, 'job already complete');
  if (job.status === 'running' || job.status === 'queued') return publicJob(job);
  job.status = 'queued';
  job.error = null;
  persist(job);
  queue.push(id);
  pump();
  return publicJob(job);
}

function persist(job) {
  writeProgress(path.join(TILES, job.outDir), job);
}

function pump() {
  if (activeId || queue.length === 0) return;
  const id = queue.shift();
  const job = jobsById.get(id);
  if (!job) {
    pump();
    return;
  }
  activeId = id;
  runJob(job)
    .catch((err) => {
      job.status = 'error';
      job.error = err instanceof Error ? err.message : String(err);
      job.updatedAt = new Date().toISOString();
      persist(job);
    })
    .finally(() => {
      activeId = null;
      pump();
    });
}

async function runJob(job) {
  const provider = getProvider(job.providerId);
  const runner = RUNNERS[provider.harvester];
  if (!runner) throw new Error(`no harvester wired for ${job.providerId}`);

  job.status = 'running';
  persist(job);

  const outDir = path.join(TILES, job.outDir);
  const onProgress = (completed) => {
    job.completed = completed;
    job.updatedAt = new Date().toISOString();
    persist(job);
  };

  const result = await runner({ job, provider, outDir, onProgress });

  job.updatedAt = new Date().toISOString();
  if (result?.unimplemented) {
    job.status = 'unsupported';
    job.error = result.message;
    persist(job);
    return;
  }

  job.status = 'done';
  job.completed = job.total;
  persist(job);
  writeMeta(outDir, {
    provider: job.providerId,
    providerLabel: job.providerLabel,
    region: job.region,
    bbox: job.bbox,
    minZoom: job.minZoom,
    maxZoom: job.maxZoom,
    acquired_at: job.updatedAt,
    format: provider.format,
    tileCount: job.total,
    attribution: provider.attribution || '',
    sourceUrl: provider.sourceUrl || '',
    notes: job.notes,
  });
}

/**
 * Boot-time only: find progress.json files left behind by a crash/restart
 * mid-harvest (status never reached "done") and register them so the UI can
 * offer Resume instead of silently losing them.
 */
export function scanResumable() {
  for (const kind of ['nautical', 'satellite']) {
    walk(path.join(TILES, kind));
  }
}

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (entries.some((e) => e.isFile() && e.name === 'progress.json')) {
    const p = readProgress(dir);
    if (p?.id && !jobsById.has(p.id) && p.status !== 'done') {
      jobsById.set(p.id, { ...p, status: p.status === 'running' ? 'interrupted' : p.status });
    }
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) walk(path.join(dir, e.name));
  }
}
