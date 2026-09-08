/**
 * Ensemble wind map layer (#91) — ECMWF IFS ENS (`ecmwf_ifs025`), 51 members
 * (control + member01..member50), always `cell_selection=sea`. Standalone
 * overlay, not the #78 router field (route/wind.mjs uses GEFS by default).
 */
const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';
const TTL_MS = 1800 * 1000;
const FORECAST_DAYS = 15;
const MAX_SIDE = 4;
const CLUSTER_STEP = 5;
const UA = 'sisu-nav/0.1 (+yacht-sisu)';

function memberLabel(id) {
  return id === 'control' ? 'Control' : `M${Number(id.replace('member', ''))}`;
}

function memberColor(id) {
  if (id === 'control') return '#e0b43a';
  const n = Number(id.replace('member', ''));
  const hue = Math.round(((n - 1) / 50) * 300);
  return `hsl(${hue}, 70%, 62%)`;
}

const cache = new Map();

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(data);
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function buildGrid(west, south, east, north) {
  west = clamp(west, -180, 180);
  east = clamp(east, -180, 180);
  south = clamp(south, -90, 90);
  north = clamp(north, -90, 90);
  if (east < west) [west, east] = [east, west];
  if (north < south) [south, north] = [north, south];
  const spanLat = Math.max(0.25, north - south);
  const spanLon = Math.max(0.25, east - west);
  const step = Math.max(0.25, Math.max(spanLat, spanLon) / (MAX_SIDE - 1));
  const lats = [];
  const lons = [];
  for (let i = 0; i < MAX_SIDE; i++) {
    const lat = south + step * i;
    const lon = west + step * i;
    if (lat <= north + 1e-6) lats.push(Number(lat.toFixed(4)));
    if (lon <= east + 1e-6) lons.push(Number(lon.toFixed(4)));
  }
  if (!lats.length) lats.push(Number(((south + north) / 2).toFixed(4)));
  if (!lons.length) lons.push(Number(((west + east) / 2).toFixed(4)));
  const latList = [];
  const lonList = [];
  for (const lat of lats) {
    for (const lon of lons) {
      latList.push(lat);
      lonList.push(lon);
    }
  }
  return { latList, lonList, step };
}

function clusterMembers() {
  const ids = ['control'];
  for (let n = CLUSTER_STEP; n <= 50; n += CLUSTER_STEP) {
    ids.push(`member${String(n).padStart(2, '0')}`);
  }
  return ids;
}

function allMembers() {
  const ids = ['control'];
  for (let n = 1; n <= 50; n++) ids.push(`member${String(n).padStart(2, '0')}`);
  return ids;
}

async function fetchEnsemble(latList, lonList) {
  const qs = new URLSearchParams({
    latitude: latList.join(','),
    longitude: lonList.join(','),
    hourly: 'wind_speed_10m,wind_direction_10m',
    models: 'ecmwf_ifs025',
    cell_selection: 'sea',
    wind_speed_unit: 'kn',
    forecast_days: String(FORECAST_DAYS),
    timezone: 'UTC',
  });
  const url = `${ENSEMBLE_URL}?${qs.toString()}`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`open-meteo ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  return Array.isArray(body) ? body : [body];
}

function memberIdsFromHourly(hourly) {
  const ids = new Set(['control']);
  for (const k of Object.keys(hourly || {})) {
    if (k.startsWith('wind_speed_10m_member')) ids.add(k.slice('wind_speed_10m_'.length));
  }
  return ids;
}

function seriesAt(hourly, kind, member, i) {
  const key = member === 'control' ? kind : `${kind}_${member}`;
  const v = hourly[key]?.[i];
  return v == null || !Number.isFinite(v) ? null : v;
}

function parseCells(payloads, wanted) {
  const times = payloads[0]?.hourly?.time || [];
  const cells = [];
  for (const loc of payloads) {
    const hourly = loc.hourly || {};
    const present = memberIdsFromHourly(hourly);
    const values = {};
    for (const id of wanted) {
      if (!present.has(id)) continue;
      const series = [];
      for (let i = 0; i < times.length; i++) {
        const tws = seriesAt(hourly, 'wind_speed_10m', id, i);
        const twd = seriesAt(hourly, 'wind_direction_10m', id, i);
        series.push(tws == null || twd == null ? null : { twd, tws });
      }
      values[id] = series;
    }
    cells.push({ lat: loc.latitude, lon: loc.longitude, values });
  }
  return { times, cells };
}

export async function handle(req, res, url) {
  if (url.pathname !== '/api/ensemble/forecast') {
    return send(res, 404, { error: 'unknown ensemble route' });
  }
  const west = Number(url.searchParams.get('west'));
  const south = Number(url.searchParams.get('south'));
  const east = Number(url.searchParams.get('east'));
  const north = Number(url.searchParams.get('north'));
  if (![west, south, east, north].every(Number.isFinite)) {
    return send(res, 400, { error: 'west,south,east,north required' });
  }
  const deep = url.searchParams.get('deep') === '1';
  const wanted = deep ? allMembers() : clusterMembers();
  const { latList, lonList, step } = buildGrid(west, south, east, north);
  const key = `${deep ? 'deep' : 'cluster'}|${step}|${latList.join(',')}|${lonList.join(',')}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) {
    return send(res, 200, { ...hit.payload, cached: true });
  }
  try {
    const body = await fetchEnsemble(latList, lonList);
    const parsed = parseCells(body, wanted);
    const payload = {
      cellSelection: 'sea',
      deep,
      models: wanted.map((id) => ({ id, label: memberLabel(id), color: memberColor(id) })),
      ttlSec: TTL_MS / 1000,
      fetchedAt: new Date().toISOString(),
      openMeteo: { models: 'ecmwf_ifs025', cell_selection: 'sea' },
      step,
      times: parsed.times,
      cells: parsed.cells,
      cached: false,
    };
    cache.set(key, { at: now, payload });
    return send(res, 200, payload);
  } catch (err) {
    return send(res, 502, { error: String(err) });
  }
}
