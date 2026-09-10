/**
 * Multi-model wind forecast for Sisu Nav (#77).
 * One Open-Meteo call with models= + cell_selection=sea. Not instrument TWD/TWS.
 */
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TTL_MS = 1800 * 1000; // same cadence as weather_openmeteo HA scan_interval
const FORECAST_HOURS = 48;
const MAX_SIDE = 8;

export const MODELS = [
  { id: 'gfs_seamless', label: 'GFS', color: '#f4c430' },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS', color: '#3ec6d8' },
  { id: 'icon_seamless', label: 'ICON', color: '#e07a3d' },
  { id: 'gem_seamless', label: 'GEM', color: '#7ae0a3' },
  // ecmwf_aifs025 returns all-null at these hours; the single-run id is populated.
  { id: 'ecmwf_aifs025_single', label: 'AIFS', color: '#c084fc' },
];

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

async function fetchOpenMeteo(latList, lonList) {
  const models = MODELS.map((m) => m.id).join(',');
  const qs = new URLSearchParams({
    latitude: latList.join(','),
    longitude: lonList.join(','),
    hourly: 'wind_speed_10m,wind_direction_10m',
    models,
    cell_selection: 'sea',
    wind_speed_unit: 'kn',
    forecast_hours: String(FORECAST_HOURS),
    timezone: 'UTC',
  });
  const url = `${FORECAST_URL}?${qs.toString()}`;
  const res = await fetch(url, {
    headers: { 'user-agent': 'sisu-nav/0.1 (+yacht-sisu)' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`open-meteo ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  return { url, body: Array.isArray(body) ? body : [body] };
}

function parseCells(payloads, step) {
  const times = payloads[0]?.hourly?.time || [];
  const cells = [];
  for (const loc of payloads) {
    const hourly = loc.hourly || {};
    const values = {};
    for (const m of MODELS) {
      const spd = hourly[`wind_speed_10m_${m.id}`] || hourly.wind_speed_10m;
      const dir = hourly[`wind_direction_10m_${m.id}`] || hourly.wind_direction_10m;
      const series = [];
      for (let i = 0; i < times.length; i++) {
        const tws = spd?.[i];
        const twd = dir?.[i];
        series.push(
          tws == null || twd == null || !Number.isFinite(tws) || !Number.isFinite(twd)
            ? null
            : { twd, tws },
        );
      }
      values[m.id] = series;
    }
    cells.push({
      lat: loc.latitude,
      lon: loc.longitude,
      values,
    });
  }
  return { times, cells, step };
}

const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const skyCache = new Map();
const radarCache = { at: 0, payload: null };

async function fetchSky(latList, lonList) {
  const qs = new URLSearchParams({
    latitude: latList.join(','),
    longitude: lonList.join(','),
    hourly: 'precipitation,cloud_cover',
    cell_selection: 'sea',
    forecast_hours: String(FORECAST_HOURS),
    timezone: 'UTC',
  });
  const res = await fetch(`${FORECAST_URL}?${qs}`, {
    headers: { 'user-agent': 'sisu-nav/0.1 (+yacht-sisu)' },
  });
  if (!res.ok) throw new Error(`open-meteo sky ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? body : [body];
}

async function fetchDust(latList, lonList) {
  const qs = new URLSearchParams({
    latitude: latList.join(','),
    longitude: lonList.join(','),
    hourly: 'dust',
    forecast_hours: String(FORECAST_HOURS),
    timezone: 'UTC',
  });
  const res = await fetch(`${AQ_URL}?${qs}`, {
    headers: { 'user-agent': 'sisu-nav/0.1 (+yacht-sisu)' },
  });
  if (!res.ok) throw new Error(`open-meteo dust ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? body : [body];
}

function parseHourlyField(payloads, field) {
  const times = payloads[0]?.hourly?.time || [];
  const cells = [];
  for (const loc of payloads) {
    const series = loc.hourly?.[field] || [];
    cells.push({
      lat: loc.latitude,
      lon: loc.longitude,
      values: times.map((_, i) => {
        const v = series[i];
        return v == null || !Number.isFinite(v) ? null : v;
      }),
    });
  }
  return { times, cells };
}

export async function handle(req, res, url) {
  if (url.pathname === '/api/weather/models') {
    return send(res, 200, { models: MODELS, cellSelection: 'sea', ttlSec: TTL_MS / 1000 });
  }
  if (url.pathname === '/api/weather/radar') {
    const now = Date.now();
    if (radarCache.payload && now - radarCache.at < 60_000) {
      return send(res, 200, { ...radarCache.payload, cached: true });
    }
    try {
      const rr = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
        headers: { 'user-agent': 'sisu-nav/0.1 (+yacht-sisu)' },
      });
      if (!rr.ok) throw new Error(`rainviewer ${rr.status}`);
      const j = await rr.json();
      const frames = [...(j.radar?.past || []), ...(j.radar?.nowcast || [])].map((f) => ({
        time: f.time,
        tiles: `https://tilecache.rainviewer.com${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
      }));
      if (!frames.length) {
        return send(res, 200, { frames: [], reason: 'RainViewer has no frames for this moment' });
      }
      const payload = {
        attribution: 'RainViewer',
        frames,
        fetchedAt: new Date().toISOString(),
      };
      radarCache.at = now;
      radarCache.payload = payload;
      return send(res, 200, payload);
    } catch (err) {
      return send(res, 502, { error: String(err) });
    }
  }
  if (url.pathname === '/api/weather/sky') {
    const west = Number(url.searchParams.get('west'));
    const south = Number(url.searchParams.get('south'));
    const east = Number(url.searchParams.get('east'));
    const north = Number(url.searchParams.get('north'));
    if (![west, south, east, north].every(Number.isFinite)) {
      return send(res, 400, { error: 'west,south,east,north required' });
    }
    const { latList, lonList, step } = buildGrid(west, south, east, north);
    const key = `sky|${step}|${latList.join(',')}|${lonList.join(',')}`;
    const hit = skyCache.get(key);
    const now = Date.now();
    if (hit && now - hit.at < TTL_MS) return send(res, 200, { ...hit.payload, cached: true });
    try {
      const [sky, dust] = await Promise.all([fetchSky(latList, lonList), fetchDust(latList, lonList)]);
      const rain = parseHourlyField(sky, 'precipitation');
      const clouds = parseHourlyField(sky, 'cloud_cover');
      const dustP = parseHourlyField(dust, 'dust');
      const payload = {
        cellSelection: 'sea',
        ttlSec: TTL_MS / 1000,
        fetchedAt: new Date().toISOString(),
        step,
        times: rain.times,
        rain: rain.cells,
        clouds: clouds.cells,
        dust: dustP.cells,
        dustTimes: dustP.times,
      };
      skyCache.set(key, { at: now, payload });
      return send(res, 200, payload);
    } catch (err) {
      return send(res, 502, { error: String(err) });
    }
  }
  if (url.pathname !== '/api/weather/forecast') {
    return send(res, 404, { error: 'unknown weather route' });
  }
  const west = Number(url.searchParams.get('west'));
  const south = Number(url.searchParams.get('south'));
  const east = Number(url.searchParams.get('east'));
  const north = Number(url.searchParams.get('north'));
  if (![west, south, east, north].every(Number.isFinite)) {
    return send(res, 400, { error: 'west,south,east,north required' });
  }
  const { latList, lonList, step } = buildGrid(west, south, east, north);
  const key = `${step}|${latList.join(',')}|${lonList.join(',')}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) {
    return send(res, 200, { ...hit.payload, cached: true });
  }
  try {
    const { body } = await fetchOpenMeteo(latList, lonList);
    const parsed = parseCells(body, step);
    const payload = {
      cellSelection: 'sea',
      models: MODELS,
      ttlSec: TTL_MS / 1000,
      fetchedAt: new Date().toISOString(),
      openMeteo: { models: MODELS.map((m) => m.id).join(','), cell_selection: 'sea' },
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
