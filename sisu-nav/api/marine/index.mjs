/**
 * Open-Meteo Marine overlays for Sisu Nav.
 * Waves / swell (#94): prefer ECMWF WAM 0.25°, combined Hs fill.
 * Currents (#95): Meteo-France SMOC (`meteofrance_currents`, ~8 km, hourly)
 * `ocean_current_velocity` + `ocean_current_direction`, `wind_speed_unit=kn`.
 * Always `cell_selection=sea`. No key. No GDAL. Copernicus only if SMOC
 * is unusable in BVI/Grenada — it is not, so no Copernicus path here.
 */
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const TTL_MS = 1800 * 1000;
const FORECAST_HOURS = 48;
const MAX_SIDE = 6;
const UA = 'sisu-nav/0.1 (+yacht-sisu)';
const HOURLY = [
  'wave_height',
  'wave_direction',
  'swell_wave_height',
  'swell_wave_direction',
  'wind_wave_height',
  'wind_wave_direction',
].join(',');

/** Prefer 0.25° WAM; fall back to 9 km WAM; then Open-Meteo best_match. */
const PREFERRED_MODELS = ['ecmwf_wam025', 'ecmwf_wam'];

const MODEL_LABELS = {
  ecmwf_wam025: 'ECMWF WAM 0.25°',
  ecmwf_wam: 'ECMWF WAM',
  best_match: 'Open-Meteo best match',
};

const CURRENT_HOURLY = ['ocean_current_velocity', 'ocean_current_direction'].join(',');
const CURRENT_MODEL = 'meteofrance_currents';
const CURRENT_MODEL_LABEL = 'Meteo-France SMOC ~8 km';
const CURRENT_MIN_STEP = 0.08;
const CURRENT_MAX_SIDE = 7;

const cache = new Map();
const currentCache = new Map();

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

function numParam(params, key) {
  const raw = params.get(key);
  if (raw == null || raw === '') return NaN;
  return Number(raw);
}

function buildGrid(west, south, east, north, opts = {}) {
  const minStep = opts.minStep ?? 0.25;
  const maxSide = opts.maxSide ?? MAX_SIDE;
  west = clamp(west, -180, 180);
  east = clamp(east, -180, 180);
  south = clamp(south, -90, 90);
  north = clamp(north, -90, 90);
  if (east < west) [west, east] = [east, west];
  if (north < south) [south, north] = [north, south];
  const spanLat = Math.max(minStep, north - south);
  const spanLon = Math.max(minStep, east - west);
  const step = Math.max(minStep, Math.max(spanLat, spanLon) / (maxSide - 1));
  const lats = [];
  const lons = [];
  for (let i = 0; i < maxSide; i++) {
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

function series(hourly, name, modelId) {
  return hourly[`${name}_${modelId}`] || hourly[name] || [];
}

function numOrNull(v) {
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
}

async function fetchMarine(latList, lonList, modelId) {
  const qs = new URLSearchParams({
    latitude: latList.join(','),
    longitude: lonList.join(','),
    hourly: HOURLY,
    cell_selection: 'sea',
    forecast_hours: String(FORECAST_HOURS),
    timezone: 'UTC',
  });
  if (modelId) qs.set('models', modelId);
  const url = `${MARINE_URL}?${qs.toString()}`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`open-meteo marine ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const body = JSON.parse(text);
  return { url, body: Array.isArray(body) ? body : [body], modelId };
}

async function fetchWithFallback(latList, lonList) {
  for (const id of PREFERRED_MODELS) {
    try {
      return await fetchMarine(latList, lonList, id);
    } catch (err) {
      if (err.status && err.status >= 400 && err.status < 500) continue;
      throw err;
    }
  }
  const fallback = await fetchMarine(latList, lonList, null);
  fallback.modelId = 'best_match';
  return fallback;
}

function parseCells(payloads, step, modelId) {
  const times = payloads[0]?.hourly?.time || [];
  const cells = [];
  let hasComponents = false;
  for (const loc of payloads) {
    const hourly = loc.hourly || {};
    const hs = series(hourly, 'wave_height', modelId);
    const dir = series(hourly, 'wave_direction', modelId);
    const swellHs = series(hourly, 'swell_wave_height', modelId);
    const swellDir = series(hourly, 'swell_wave_direction', modelId);
    const windSeaHs = series(hourly, 'wind_wave_height', modelId);
    const windSeaDir = series(hourly, 'wind_wave_direction', modelId);
    const hsOut = [];
    const dirOut = [];
    const swellHsOut = [];
    const swellDirOut = [];
    const windSeaHsOut = [];
    const windSeaDirOut = [];
    for (let i = 0; i < times.length; i++) {
      const h = numOrNull(hs[i]);
      const d = numOrNull(dir[i]);
      const sh = numOrNull(swellHs[i]);
      const sd = numOrNull(swellDir[i]);
      const wh = numOrNull(windSeaHs[i]);
      const wd = numOrNull(windSeaDir[i]);
      hsOut.push(h);
      dirOut.push(d);
      swellHsOut.push(sh);
      swellDirOut.push(sd);
      windSeaHsOut.push(wh);
      windSeaDirOut.push(wd);
      if (sh != null && wh != null) hasComponents = true;
    }
    cells.push({
      lat: loc.latitude,
      lon: loc.longitude,
      hs: hsOut,
      dir: dirOut,
      swellHs: swellHsOut,
      swellDir: swellDirOut,
      windSeaHs: windSeaHsOut,
      windSeaDir: windSeaDirOut,
    });
  }
  return { times, cells, step, hasComponents };
}

async function fetchCurrents(latList, lonList) {
  const qs = new URLSearchParams({
    latitude: latList.join(','),
    longitude: lonList.join(','),
    hourly: CURRENT_HOURLY,
    cell_selection: 'sea',
    forecast_hours: String(FORECAST_HOURS),
    timezone: 'UTC',
    models: CURRENT_MODEL,
    wind_speed_unit: 'kn',
  });
  const url = `${MARINE_URL}?${qs.toString()}`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`open-meteo marine currents ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const body = JSON.parse(text);
  return { body: Array.isArray(body) ? body : [body] };
}

function parseCurrentCells(payloads, step) {
  const times = payloads[0]?.hourly?.time || [];
  const cells = [];
  let seaCount = 0;
  for (const loc of payloads) {
    const hourly = loc.hourly || {};
    const vel = series(hourly, 'ocean_current_velocity', CURRENT_MODEL);
    const dir = series(hourly, 'ocean_current_direction', CURRENT_MODEL);
    const velOut = [];
    const dirOut = [];
    let any = false;
    for (let i = 0; i < times.length; i++) {
      const v = numOrNull(vel[i]);
      const d = numOrNull(dir[i]);
      velOut.push(v);
      dirOut.push(d);
      if (v != null && d != null) any = true;
    }
    if (any) seaCount += 1;
    cells.push({
      lat: loc.latitude,
      lon: loc.longitude,
      velocityKn: velOut,
      dir: dirOut,
    });
  }
  return { times, cells, step, seaCount };
}

function bboxOr400(url, res) {
  const west = numParam(url.searchParams, 'west');
  const south = numParam(url.searchParams, 'south');
  const east = numParam(url.searchParams, 'east');
  const north = numParam(url.searchParams, 'north');
  if (![west, south, east, north].every(Number.isFinite)) {
    send(res, 400, { error: 'west,south,east,north required' });
    return null;
  }
  return { west, south, east, north };
}

export async function handle(req, res, url) {
  if (url.pathname === '/api/marine/models') {
    return send(res, 200, {
      preferred: PREFERRED_MODELS,
      labels: MODEL_LABELS,
      cellSelection: 'sea',
      ttlSec: TTL_MS / 1000,
      note: 'ECMWF WAM typically returns combined Hs + direction; swell vs wind-sea only when those series populate.',
    });
  }
  if (url.pathname === '/api/marine/currents') {
    const bbox = bboxOr400(url, res);
    if (!bbox) return;
    const { latList, lonList, step } = buildGrid(bbox.west, bbox.south, bbox.east, bbox.north, {
      minStep: CURRENT_MIN_STEP,
      maxSide: CURRENT_MAX_SIDE,
    });
    const key = `cur|${step}|${latList.join(',')}|${lonList.join(',')}`;
    const hit = currentCache.get(key);
    const now = Date.now();
    if (hit && now - hit.at < TTL_MS) {
      return send(res, 200, { ...hit.payload, cached: true });
    }
    try {
      const { body } = await fetchCurrents(latList, lonList);
      const parsed = parseCurrentCells(body, step);
      const payload = {
        cellSelection: 'sea',
        model: { id: CURRENT_MODEL, label: CURRENT_MODEL_LABEL },
        ttlSec: TTL_MS / 1000,
        fetchedAt: new Date().toISOString(),
        openMeteo: {
          models: CURRENT_MODEL,
          cell_selection: 'sea',
          wind_speed_unit: 'kn',
        },
        units: { velocity: 'kn', direction: 'towards' },
        step,
        times: parsed.times,
        cells: parsed.cells,
        seaCount: parsed.seaCount,
        cached: false,
      };
      currentCache.set(key, { at: now, payload });
      return send(res, 200, payload);
    } catch (err) {
      return send(res, 502, { error: String(err) });
    }
  }
  if (url.pathname !== '/api/marine/forecast') {
    return send(res, 404, { error: 'unknown marine route' });
  }
  const bbox = bboxOr400(url, res);
  if (!bbox) return;
  const { west, south, east, north } = bbox;
  const { latList, lonList, step } = buildGrid(west, south, east, north);
  const key = `${step}|${latList.join(',')}|${lonList.join(',')}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) {
    return send(res, 200, { ...hit.payload, cached: true });
  }
  try {
    const { body, modelId } = await fetchWithFallback(latList, lonList);
    const parsed = parseCells(body, step, modelId);
    const payload = {
      cellSelection: 'sea',
      model: { id: modelId, label: MODEL_LABELS[modelId] || modelId },
      ttlSec: TTL_MS / 1000,
      fetchedAt: new Date().toISOString(),
      openMeteo: { models: modelId, cell_selection: 'sea' },
      step,
      times: parsed.times,
      cells: parsed.cells,
      hasComponents: parsed.hasComponents,
      cached: false,
    };
    cache.set(key, { at: now, payload });
    return send(res, 200, payload);
  } catch (err) {
    return send(res, 502, { error: String(err) });
  }
}
