/**
 * Opt-in community wind roses (#88). Browser never holds the service role.
 * Public cells are only those with boat_count >= 3 (k-anonymity).
 */
import { BINS, N_PETALS } from './spec.mjs';
const MIN_BOATS = 3;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function cfg() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE;
  const isSet = (v) => Boolean(v) && v !== 'CHANGE_ME';
  return {
    url,
    anon: isSet(anon) ? anon : '',
    service: isSet(service) ? service : '',
    configured: Boolean(url && (isSet(anon) || isSet(service))),
  };
}

async function rest(path, { method = 'GET', body, key } = {}) {
  const { url } = cfg();
  if (!url || !key) throw httpError(503, 'community roses not configured');
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw httpError(res.status, (json && json.message) || `supabase ${res.status}`);
  }
  return json;
}

function monthKey(month) {
  if (month == null || month === '' || month === 'all') return 0;
  const n = Number(month);
  if (!Number.isInteger(n) || n < 0 || n > 12) return 0;
  return n;
}

function mergePetals(rows) {
  const totalN = rows.reduce((s, r) => s + (Number(r.sample_count) || 0), 0) || 1;
  const calm = rows.reduce((s, r) => s + (Number(r.calm_frac) || 0) * (Number(r.sample_count) || 0), 0) / totalN;
  const byDeg = new Map();
  for (const row of rows) {
    const w = (Number(row.sample_count) || 0) / totalN;
    const petals = Array.isArray(row.petals) ? row.petals : [];
    for (const p of petals) {
      const deg = Number(p.deg);
      let acc = byDeg.get(deg);
      if (!acc) {
        acc = { deg, total: 0, bands: {} };
        byDeg.set(deg, acc);
      }
      acc.total += (Number(p.total) || 0) * w;
      for (const [k, v] of Object.entries(p.bands || {})) {
        acc.bands[k] = (acc.bands[k] || 0) + Number(v) * w;
      }
    }
  }
  return { petals: [...byDeg.values()].sort((a, b) => a.deg - b.deg), calm_frac: calm, sample_count: totalN };
}

export async function listCommunity({ west, south, east, north, month }) {
  const c = cfg();
  if (!c.configured) return { configured: false, cells: [], minBoats: MIN_BOATS };
  const key = c.service || c.anon;
  const m = monthKey(month);
  let q = `wind_rose_cells?select=geohash,lat,lon,month,calm_frac,petals,sample_count,boat_count&boat_count=gte.${MIN_BOATS}&month=eq.${m}`;
  const rows = (await rest(q, { key })) || [];
  const cells = rows
    .filter((r) => {
      if (![west, south, east, north].every(Number.isFinite)) return true;
      return r.lon >= west && r.lon <= east && r.lat >= south && r.lat <= north;
    })
    .map((r) => ({
      geohash: r.geohash,
      lat: r.lat,
      lon: r.lon,
      n: r.sample_count,
      calmPct: (Number(r.calm_frac) || 0) * 100,
      petals: r.petals,
      boatCount: r.boat_count,
      community: true,
    }));
  return {
    configured: true,
    cells,
    minBoats: MIN_BOATS,
    spec: { bins: BINS, petals: N_PETALS, calmMax: 2, geohash: 5 },
  };
}

export async function shareRoses({ boatId, month, cells }) {
  const c = cfg();
  if (!c.configured) throw httpError(503, 'community roses not configured');
  if (!c.service) throw httpError(503, 'supabase_service_role not set — uploads stay off until the service role is in secrets.yaml');
  const uuid = String(boatId || '');
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) throw httpError(400, 'boatId uuid required');
  if (!Array.isArray(cells) || !cells.length) throw httpError(400, 'cells required');
  const m = monthKey(month);
  let upserted = 0;
  for (const cell of cells) {
    const geohash = String(cell.geohash || '');
    const lat = Number(cell.lat);
    const lon = Number(cell.lon);
    const sample_count = Number(cell.n || cell.sample_count || 0);
    if (!geohash || !Number.isFinite(lat) || !Number.isFinite(lon) || sample_count < 1) continue;
    const calm_frac = Number(cell.calmPct != null ? cell.calmPct / 100 : cell.calm_frac) || 0;
    const row = {
      boat_id: uuid,
      geohash,
      month: m,
      lat,
      lon,
      petals: cell.petals,
      sample_count,
      calm_frac,
      updated_at: new Date().toISOString(),
    };
    await rest('wind_rose_uploads?on_conflict=boat_id,geohash,month', { method: 'POST', body: row, key: c.service });
    upserted += 1;
    const uploads =
      (await rest(
        `wind_rose_uploads?geohash=eq.${encodeURIComponent(geohash)}&month=eq.${m}`,
        { key: c.service },
      )) || [];
    const merged = mergePetals(uploads);
    const boats = new Set(uploads.map((u) => u.boat_id)).size;
    const loc = `POINT(${lon} ${lat})`;
    await rest('wind_rose_cells?on_conflict=geohash,month', {
      method: 'POST',
      body: {
        geohash,
        loc,
        lat,
        lon,
        month: m,
        calm_frac: merged.calm_frac,
        petals: merged.petals,
        sample_count: merged.sample_count,
        boat_count: boats,
        updated_at: new Date().toISOString(),
      },
      key: c.service,
    });
  }
  return { uploaded: upserted };
}

export function communityConfigured() {
  return cfg().configured;
}
