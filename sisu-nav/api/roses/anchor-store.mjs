/**
 * Anchor-spot wind roses (#187) — local store, scheduler, Supabase sync.
 *
 * Local JSON under SISU_STATE_DIR (compose: ../sisu-nav/state, excluded from
 * f8-deploy rsync — box runtime state) is the working copy, so spots build up
 * with no internet and no Supabase. Supabase (SisuMate project) is a mirror:
 * dirty hour rows + spot summaries are upserted when service role + boat id
 * are set, and stay dirty until a push succeeds.
 *
 * Every cycle re-reads a trailing window from Sisu_1m and rewrites the hours
 * in it (keyed by hour start), so overlapping runs never double-count. The
 * first REPLACE_SKIP of the window is context only — a stay cut off by the
 * window start must not rewrite hours it already got right.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEASUREMENTS, OPTS, detectStays, distM, hourRows, spotSummary } from './anchor.mjs';
import { cfg as supabaseCfg, shareRoses } from './community.mjs';
import { encodeGeohash } from './geohash.mjs';
import { queryFlux, influxAuth } from './influx.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUCKET = process.env.INFLUXDB_ROSES_BUCKET || 'Sisu_1m';
const HOUR = 3600 * 1000;
const LOOKBACK = 24 * HOUR;
const REPLACE_SKIP = 12 * HOUR;
const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
export const EVERY_MIN = num('ANCHOR_ROSES_EVERY_MIN', 15);
export const SYNC_MIN = num('ANCHOR_ROSES_SYNC_MIN', 60);
const BACKFILL_DAYS = num('ANCHOR_ROSES_BACKFILL_DAYS', 120);

function storeFile() {
  const dir = process.env.SISU_STATE_DIR || path.join(HERE, '..', '..', 'state');
  return path.join(dir, 'anchor-roses.json');
}

function emptyStore() {
  return {
    version: 1,
    lastRunAt: null,
    lastSyncAt: null,
    lastSyncError: null,
    syncedBoatId: null,
    // Community opt-in (#88 rules: k ≥ 3 boats) under its own random id, not
    // the SisuMate boat id, so community rows never point back at the boat.
    community: { optIn: false, uuid: null, lastAt: null, lastError: null, sentAt: null },
    hours: {},
    spots: {},
    stays: [],
  };
}

let store = null;
function load() {
  if (store) return store;
  try {
    const disk = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
    store = { ...emptyStore(), ...disk, community: { ...emptyStore().community, ...(disk.community || {}) } };
  } catch (err) {
    if (err && err.code !== 'ENOENT') console.error('anchor-roses: store unreadable, starting fresh', err.message);
    store = emptyStore();
  }
  return store;
}

function save() {
  const file = storeFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, file);
}

const strip = ({ dirty, spotId, ...row }) => row;
const same = (a, b) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));

function zeroed(row) {
  return { ...row, minutes: 0, n: 0, calm: 0, counts: {}, sin: 0, cos: 0, maxKn: 0, swingM: 0 };
}

/** Nearest spot within merge radius, else a new one. */
function assignSpot(s, lat, lon) {
  let best = null;
  let bestD = Infinity;
  for (const [id, sp] of Object.entries(s.spots)) {
    if (!sp.minutes) continue;
    const d = distM(lat, lon, sp.lat, sp.lon);
    if (d < bestD) {
      best = id;
      bestD = d;
    }
  }
  if (best && bestD <= OPTS.mergeM) return best;
  const id = crypto.randomUUID();
  s.spots[id] = { id, lat, lon, minutes: 1 };
  return id;
}

function fluxFor(sinceMs) {
  const set = MEASUREMENTS.map((m) => `"${m}"`).join(', ');
  return (
    `from(bucket: "${BUCKET}")\n` +
    `  |> range(start: ${new Date(sinceMs).toISOString()})\n` +
    `  |> filter(fn: (r) => r._field == "value")\n` +
    `  |> filter(fn: (r) => contains(value: r._measurement, set: [${set}]))\n` +
    `  |> keep(columns: ["_time", "_measurement", "_value"])\n`
  );
}

/**
 * A stay that picks up where a stored anchored stay left off (same place,
 * ≤ 2 h earlier) is that stay: take its verdict and location. Covers the
 * window cutting a long stay in two, and overnight stretches with the
 * instruments off (no heading → no swing check of their own).
 */
function continueStay(s, st) {
  if (st.accepted && !st.undecided && st.source === 'alarm') return;
  let prev = null;
  for (const [hour, r] of Object.entries(s.hours)) {
    const h = Date.parse(hour);
    if (!r.minutes || h >= st.start || h + HOUR < st.start - 2 * HOUR) continue;
    if (distM(r.lat, r.lon, st.lat, st.lon) > OPTS.mergeM) continue;
    if (!prev || hour > prev[0]) prev = [hour, r];
  }
  if (!prev) return;
  const [, r] = prev;
  Object.assign(st, { lat: r.lat, lon: r.lon, source: r.source });
  if (st.undecided) Object.assign(st, { accepted: true, undecided: false, reason: 'continues an anchored stay' });
}

let running = null;

export async function runCycle({ now = Date.now() } = {}) {
  if (running) return running;
  running = (async () => {
    const s = load();
    if (!influxAuth().token) throw Object.assign(new Error('INFLUXDB_TOKEN unset'), { status: 503 });
    const last = s.lastRunAt ? Date.parse(s.lastRunAt) : null;
    const since = last ? Math.min(now, last) - LOOKBACK : now - BACKFILL_DAYS * 24 * HOUR;
    const replaceFrom = last ? since + REPLACE_SKIP : since;
    const series = await queryFlux(fluxFor(since));
    const stays = detectStays(series);
    for (const st of stays) continueStay(s, st);
    const fresh = new Map(
      hourRows(series, stays)
        .filter((r) => Date.parse(r.hour) >= replaceFrom)
        .map((r) => [r.hour, r]),
    );
    const touched = new Set();
    for (const [hour, old] of Object.entries(s.hours)) {
      if (Date.parse(hour) < replaceFrom || fresh.has(hour) || !old.minutes) continue;
      s.hours[hour] = { ...zeroed(old), spotId: old.spotId, dirty: true };
      touched.add(old.spotId);
    }
    for (const [hour, row] of fresh) {
      const old = s.hours[hour];
      if (old && same(old, row)) continue;
      const keep = old && old.spotId && s.spots[old.spotId] && distM(old.lat, old.lon, row.lat, row.lon) < 1;
      const spotId = keep ? old.spotId : assignSpot(s, row.lat, row.lon);
      if (old?.spotId && old.spotId !== spotId) touched.add(old.spotId);
      s.hours[hour] = { ...row, spotId, dirty: true };
      touched.add(spotId);
    }
    for (const id of touched) {
      if (!id) continue;
      const rows = Object.values(s.hours).filter((r) => r.spotId === id);
      // A spot whose hours all went away keeps its last place with 0 minutes,
      // so the mirror learns it is gone instead of keeping a stale rose.
      s.spots[id] = rows.some((r) => r.minutes > 0)
        ? { ...spotSummary(id, rows), dirty: true, updatedAt: new Date(now).toISOString() }
        : { ...s.spots[id], minutes: 0, dirty: true };
    }
    s.stays = stays.slice(-30).map(({ positions, ...st }) => ({
      ...st,
      start: new Date(st.start).toISOString(),
      end: new Date(st.end).toISOString(),
    }));
    s.lastRunAt = new Date(now).toISOString();
    save();
    return { since: new Date(since).toISOString(), stays: stays.length, hours: fresh.size, touched: touched.size };
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

function syncCfg() {
  const c = supabaseCfg();
  const boatId = (process.env.SISU_BOAT_ID || '').trim();
  const ok = Boolean(c.url && c.service && boatId && boatId !== 'CHANGE_ME');
  return { ...c, boatId, ok };
}

async function upsert(table, conflict, rows, key) {
  const { url } = supabaseCfg();
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${conflict}`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        prefer: 'return=minimal,resolution=merge-duplicates',
      },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = text.slice(0, 200);
      try {
        msg = JSON.parse(text).message || msg;
      } catch {
        /* not JSON */
      }
      throw new Error(`${table}: supabase ${res.status} ${msg}`);
    }
  }
}

export async function syncNow() {
  const s = load();
  const c = syncCfg();
  if (!c.ok) return { synced: false, reason: 'needs SUPABASE_URL + SUPABASE_SERVICE_ROLE + SISU_BOAT_ID' };
  if (s.syncedBoatId !== c.boatId) {
    for (const r of Object.values(s.hours)) r.dirty = true;
    for (const sp of Object.values(s.spots)) sp.dirty = true;
  }
  const hours = Object.entries(s.hours).filter(([, r]) => r.dirty);
  const spots = Object.values(s.spots).filter((sp) => sp.dirty && Number.isFinite(sp.lat));
  try {
    const at = new Date().toISOString();
    await upsert(
      'anchor_spots',
      'boat_id,spot_id',
      spots.map((sp) => ({
        boat_id: c.boatId,
        spot_id: sp.id,
        lat: sp.lat,
        lon: sp.lon,
        loc: `POINT(${sp.lon} ${sp.lat})`,
        minutes: sp.minutes,
        visits: sp.visits || 0,
        sample_count: sp.n || 0,
        calm_frac: (sp.calmPct || 0) / 100,
        petals: sp.petals || null,
        steadiness: sp.steadiness,
        swing_m: sp.swingM,
        max_kn: sp.maxKn,
        first_seen: sp.firstSeen,
        last_seen: sp.lastSeen,
        updated_at: at,
      })),
      c.service,
    );
    await upsert(
      'anchor_rose_hours',
      'boat_id,hour',
      hours.map(([hour, r]) => ({
        boat_id: c.boatId,
        hour,
        spot_id: r.spotId,
        stay_start: r.stayStart,
        lat: r.lat,
        lon: r.lon,
        source: r.source,
        minutes: r.minutes,
        sample_count: r.n,
        calm_count: r.calm,
        counts: r.counts,
        sin_sum: r.sin,
        cos_sum: r.cos,
        max_kn: r.maxKn,
        swing_m: r.swingM,
        updated_at: at,
      })),
      c.service,
    );
    for (const [, r] of hours) delete r.dirty;
    for (const sp of spots) delete sp.dirty;
    Object.assign(s, { syncedBoatId: c.boatId, lastSyncAt: at, lastSyncError: null });
    save();
    return { synced: true, hours: hours.length, spots: spots.length };
  } catch (err) {
    s.lastSyncError = err instanceof Error ? err.message : String(err);
    save();
    return { synced: false, reason: s.lastSyncError };
  }
}

/** Opt-in: anchor-spot roses also go to the community tables (geohash-7). */
export function setCommunityOptIn(on) {
  const s = load();
  s.community.optIn = Boolean(on);
  if (s.community.optIn && !s.community.uuid) s.community.uuid = crypto.randomUUID();
  s.community.sentAt = null;
  save();
  return status();
}

export async function shareCommunity() {
  const s = load();
  const c = s.community;
  if (!c.optIn) return { shared: false, reason: 'not opted in' };
  if (!supabaseCfg().service) return { shared: false, reason: 'supabase_service_role not set' };
  const changed = Object.values(s.spots).some((sp) => sp.updatedAt && (!c.sentAt || sp.updatedAt > c.sentAt));
  if (c.sentAt && !changed) return { shared: false, reason: 'nothing new' };
  const cells = Object.values(s.spots)
    .filter((sp) => sp.minutes > 0 && sp.n > 0)
    .map((sp) => ({ geohash: encodeGeohash(sp.lat, sp.lon, 7), lat: sp.lat, lon: sp.lon, n: sp.n, calmPct: sp.calmPct, petals: sp.petals }));
  try {
    const r = cells.length ? await shareRoses({ boatId: c.uuid, month: 0, cells }) : { uploaded: 0 };
    Object.assign(c, { sentAt: new Date().toISOString(), lastAt: new Date().toISOString(), lastError: null });
    save();
    return { shared: true, ...r };
  } catch (err) {
    c.lastError = err instanceof Error ? err.message : String(err);
    save();
    return { shared: false, reason: c.lastError };
  }
}

export function status() {
  const s = load();
  const c = syncCfg();
  return {
    lastRunAt: s.lastRunAt,
    lastSyncAt: s.lastSyncAt,
    lastSyncError: s.lastSyncError,
    syncConfigured: c.ok,
    communityOptIn: s.community.optIn,
    communityAt: s.community.lastAt,
    communityError: s.community.lastError,
    pendingHours: Object.values(s.hours).filter((r) => r.dirty).length,
    everyMin: EVERY_MIN,
    syncMin: SYNC_MIN,
    mergeM: OPTS.mergeM,
  };
}

export function listSpots() {
  const s = load();
  const spots = Object.values(s.spots)
    .filter((sp) => sp.minutes > 0 && sp.lastSeen)
    .map(({ dirty, updatedAt, ...sp }) => sp)
    .sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));
  return { spots, stays: s.stays, status: status() };
}

let started = false;
export function startAnchorRoses() {
  if (started || process.env.ANCHOR_ROSES_DISABLE === '1') return;
  started = true;
  let lastSync = 0;
  const tick = async () => {
    try {
      await runCycle();
      if (Date.now() - lastSync >= SYNC_MIN * 60 * 1000) {
        lastSync = Date.now();
        const r = await syncNow();
        if (!r.synced && syncCfg().ok) console.error('anchor-roses sync:', r.reason);
        const k = await shareCommunity();
        if (!k.shared && load().community.optIn && k.reason !== 'nothing new') console.error('anchor-roses community:', k.reason);
      }
    } catch (err) {
      console.error('anchor-roses cycle:', err instanceof Error ? err.message : err);
    }
  };
  setTimeout(tick, 30 * 1000);
  setInterval(tick, EVERY_MIN * 60 * 1000).unref();
}
