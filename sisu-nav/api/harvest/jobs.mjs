/**
 * Harvest job orchestration. Folders are keyed by provider **sourceDate**
 * (#83), not the calendar day we downloaded. Same product date reuses the
 * existing MBTiles and only fills holes. A complete covering snapshot is
 * skipped. Single in-process worker; no new compose service.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getProvider, isSecretConfigured } from './providers.mjs';
import { checkQuota } from './quota.mjs';
import { countTiles } from './grid.mjs';
import { countMissingTiles, openMbtiles } from './mbtiles.mjs';
import { resolveSource } from './sourceDate.mjs';
import { listSnapshots, pickSnapshot, unionBbox } from './snapshots.mjs';
import { runEox } from './fetchers/eox.mjs';
import { runGibs } from './fetchers/gibs.mjs';
import { runEsri } from './fetchers/esri.mjs';
import { runNoaaEnc } from './fetchers/noaa-enc.mjs';
import { runSecretGated } from './fetchers/secret-gated.mjs';
import { runMapbox } from './fetchers/mapbox.mjs';
import { runWmts } from './fetchers/wmts.mjs';

const TILES = process.env.SISU_TILES_DIR || '/data/tiles';
const STUB_HARVESTERS = new Set(['noaa-enc', 'maptiler', 'maxar', 'planet']);

const RUNNERS = {
  eox: runEox,
  gibs: runGibs,
  esri: runEsri,
  'noaa-enc': runNoaaEnc,
  maptiler: runSecretGated,
  maxar: runSecretGated,
  planet: runSecretGated,
  mapbox: runMapbox,
  wmts: runWmts,
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

function snapshotDir(kind, providerId, region, sourceDate) {
  return path.join(TILES, kind, providerId, slug(region), slug(sourceDate));
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
  const { inCoverage, coverageReason } = coverageState(provider, bbox);
  return {
    tileCount,
    minZoom: zMin,
    maxZoom: zMax,
    limitTiles,
    withinLimit: limitTiles == null || tileCount <= limitTiles,
    quota: checkQuota(TILES),
    inCoverage,
    coverageReason,
  };
}

function validateBbox(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    throw httpError(400, 'bbox must be [west, south, east, north]');
  }
}

function bboxIntersects(a, b) {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

function coverageState(provider, bbox) {
  const cov = provider.coverageBbox;
  if (!Array.isArray(cov) || cov.length !== 4) {
    return { inCoverage: true, coverageReason: null };
  }
  if (bboxIntersects(bbox, cov)) return { inCoverage: true, coverageReason: null };
  return {
    inCoverage: false,
    coverageReason: provider.outOfCoverageReason || `no ${provider.label} in this view`,
  };
}

function mbtilesPath(dir, providerId) {
  return path.join(dir, `${providerId}.mbtiles`);
}

export async function createJob({ providerId, region, bbox, minZoom, maxZoom, time, notes }) {
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
  if (!est.inCoverage) {
    throw httpError(400, est.coverageReason || `no ${providerId} in this view`);
  }
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
        ? 'harvest disk quota exceeded — free up sisu-nav/tiles/ before starting a new harvest job'
        : 'volume is low on free disk space — refusing to start a new harvest job',
    );
  }

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
    outDir: '',
    status: 'queued',
    mode: 'harvest',
    sourceDate: null,
    total: est.tileCount,
    completed: 0,
    fetched: 0,
    failed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  };

  if (STUB_HARVESTERS.has(provider.harvester)) {
    const outDir = snapshotDir(provider.kind, providerId, job.region, job.createdAt.slice(0, 10));
    job.outDir = path.relative(TILES, outDir);
    jobsById.set(id, job);
    writeProgress(outDir, job);
    queue.push(id);
    pump();
    return publicJob(job);
  }

  const source = await resolveSource(provider, job);
  job.sourceDate = source.sourceDate;
  if (source.layerId) job.layerId = source.layerId;
  if (source.etag) job.etag = source.etag;

  const snaps = listSnapshots(TILES, provider.kind, providerId, provider);
  const picked = pickSnapshot(snaps, source.sourceDate, bbox, zMin, zMax);
  const outDir = picked
    ? picked.dir
    : snapshotDir(provider.kind, providerId, job.region, source.sourceDate);
  job.outDir = path.relative(TILES, outDir);

  const file = picked?.mbtiles || mbtilesPath(outDir, providerId);
  const missing = countMissingTiles(file, bbox, zMin, zMax);

  if (picked && missing === 0) {
    job.status = 'skipped';
    job.mode = 'skip';
    job.completed = est.tileCount;
    job.fetched = 0;
    job.notes = `sourceDate ${source.sourceDate} unchanged; view already complete`;
    job.updatedAt = new Date().toISOString();
    jobsById.set(id, job);
    return publicJob(job);
  }

  if (picked) {
    job.mode = 'fill';
    job.total = missing;
  } else {
    job.mode = 'harvest';
  }

  jobsById.set(id, job);
  writeProgress(outDir, job);
  queue.push(id);
  pump();
  return publicJob(job);
}

export function resumeJob(id) {
  const job = jobsById.get(id);
  if (!job) throw httpError(404, 'job not found');
  if (job.status === 'done' || job.status === 'skipped') throw httpError(400, 'job already complete');
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
  const onProgress = (completed, fetched, failed) => {
    if (typeof fetched === 'number') job.fetched = fetched;
    if (typeof failed === 'number') job.failed = failed;
    // Fill jobs: total is *missing* tiles, not the whole grid walk.
    job.completed =
      job.mode === 'fill' && typeof fetched === 'number'
        ? fetched + (typeof failed === 'number' ? failed : 0)
        : completed;
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

  const fetched = result?.fetched ?? 0;
  const failed = result?.failed ?? 0;
  job.fetched = fetched;
  job.failed = failed;
  job.completed = job.mode === 'fill' ? fetched + failed : (result?.completed ?? job.total);
  job.status = 'done';
  const notes = [];
  if (job.notes) notes.push(job.notes);
  if (failed > 0) notes.push(`${failed} tile(s) unavailable — skipped, will retry next harvest`);
  if (job.mode === 'fill' && fetched === 0) {
    notes.push('none landed in the MBTiles (fetch failed or response was not an image)');
  }
  job.notes = notes.join('; ') || job.notes;
  persist(job);

  const file = mbtilesPath(outDir, job.providerId);
  let tileCount = result?.tileCount;
  if (tileCount == null && fs.existsSync(file)) {
    const mb = openMbtiles(file, null);
    try {
      tileCount = mb.countAll();
    } finally {
      mb.close();
    }
  }

  const prev = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(outDir, 'meta.json'), 'utf8'));
    } catch {
      return {};
    }
  })();

  // Only widen the recorded min/maxZoom (what pickSnapshot's "covering" match
  // trusts to skip a future harvest outright, see #110) when this run had no
  // failed tiles anywhere in its requested range — a run with skipped tiles
  // must not get recorded as fully covering a zoom level it didn't actually
  // finish. countMissingTiles() re-checks real tile presence regardless, so
  // this only affects whether pickSnapshot can skip re-checking at all.
  const zoomVerified = failed === 0;
  writeMeta(outDir, {
    ...prev,
    provider: job.providerId,
    providerLabel: job.providerLabel,
    region: job.region,
    bbox: prev.bbox ? unionBbox(prev.bbox, job.bbox) : job.bbox,
    minZoom: zoomVerified ? Math.min(prev.minZoom ?? job.minZoom, job.minZoom) : prev.minZoom ?? job.minZoom,
    maxZoom: zoomVerified ? Math.max(prev.maxZoom ?? job.maxZoom, job.maxZoom) : prev.maxZoom ?? job.minZoom,
    acquired_at: job.updatedAt,
    sourceDate: job.sourceDate || prev.sourceDate || null,
    layerId: job.layerId || prev.layerId || null,
    etag: job.etag || prev.etag || null,
    format: provider.format,
    tileCount: tileCount ?? job.total,
    attribution: provider.attribution || '',
    sourceUrl: provider.sourceUrl || '',
    notes: job.notes,
  });
}

export function scanResumable() {
  for (const kind of ['nautical', 'satellite', 'bathymetry']) {
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
    if (p?.id && !jobsById.has(p.id) && p.status !== 'done' && p.status !== 'skipped') {
      jobsById.set(p.id, { ...p, status: p.status === 'running' ? 'interrupted' : p.status });
    }
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) walk(path.join(dir, e.name));
  }
}
