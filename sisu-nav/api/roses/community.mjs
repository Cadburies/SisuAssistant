/**
 * Community wind roses (#88, user-level since #187). One shared table set
 * that every app reads and writes as its own user:
 * - wind_rose_uploads: one row per (boat, geohash, month) — each boat writes
 *   only its own rows (RLS via accessible_boat_ids()).
 * - wind_rose_cells: the merged roses. A security-definer trigger in the DB
 *   rebuilds a cell from all its uploads (migration 003), so no client ever
 *   needs write access to it. Readable by anyone once boat_count >= 3.
 * Month 0 = all year.
 */
import { BINS, N_PETALS } from './spec.mjs';
import { authCfg, rest, resolveBoat } from './supabase-auth.mjs';

const MIN_BOATS = 3;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function monthKey(month) {
  if (month == null || month === '' || month === 'all') return 0;
  const n = Number(month);
  if (!Number.isInteger(n) || n < 0 || n > 12) return 0;
  return n;
}

export async function listCommunity({ west, south, east, north, month }) {
  const c = authCfg();
  if (!c.canRead) return { configured: false, cells: [], minBoats: MIN_BOATS };
  const m = monthKey(month);
  let q = `wind_rose_cells?select=geohash,lat,lon,month,calm_frac,petals,sample_count,boat_count&boat_count=gte.${MIN_BOATS}&month=eq.${m}`;
  if ([west, south, east, north].every(Number.isFinite)) {
    q += `&lon=gte.${west}&lon=lte.${east}&lat=gte.${south}&lat=lte.${north}`;
  }
  const rows = (await rest(q, { user: false })) || [];
  return {
    configured: true,
    cells: rows.map((r) => ({
      geohash: r.geohash,
      lat: r.lat,
      lon: r.lon,
      n: r.sample_count,
      calmPct: (Number(r.calm_frac) || 0) * 100,
      petals: r.petals,
      boatCount: r.boat_count,
      community: true,
    })),
    minBoats: MIN_BOATS,
    spec: { bins: BINS, petals: N_PETALS, calmMax: 2, geohash: 5 },
  };
}

/** Upsert this boat's contribution for each cell; the DB merges the rest. */
export async function shareRoses({ month, cells }) {
  if (!authCfg().canSignIn) throw httpError(503, 'community sharing needs supabase_email + supabase_password');
  if (!Array.isArray(cells) || !cells.length) throw httpError(400, 'cells required');
  const { id: boatId } = await resolveBoat();
  const m = monthKey(month);
  const at = new Date().toISOString();
  const rows = [];
  for (const cell of cells) {
    const geohash = String(cell.geohash || '');
    const lat = Number(cell.lat);
    const lon = Number(cell.lon);
    const sample_count = Number(cell.n || cell.sample_count || 0);
    if (!geohash || !Number.isFinite(lat) || !Number.isFinite(lon) || sample_count < 1) continue;
    rows.push({
      boat_id: boatId,
      geohash,
      month: m,
      lat,
      lon,
      petals: cell.petals,
      sample_count,
      calm_frac: Number(cell.calmPct != null ? cell.calmPct / 100 : cell.calm_frac) || 0,
      updated_at: at,
    });
  }
  if (rows.length) {
    await rest('wind_rose_uploads?on_conflict=boat_id,geohash,month', {
      method: 'POST',
      body: rows,
      prefer: 'return=minimal,resolution=merge-duplicates',
    });
  }
  return { uploaded: rows.length };
}

export function communityConfigured() {
  return authCfg().canRead;
}
