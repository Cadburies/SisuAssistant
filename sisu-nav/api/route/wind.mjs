/**
 * Open-Meteo Ensemble + multi-model forecast + marine Hs.
 * Always cell_selection=sea. No GRIB/NOMADS unless JSON is unusable.
 */
import { circMean, circStd, padBbox, quantile, stdev } from './geo.mjs';

const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const UA = 'sisu-nav/0.1 (+yacht-sisu)';
const TTL_MS = 1800 * 1000;
const FORECAST_HOURS = 72;
const MAX_SIDE = 5;

export const MODELS = [
  { id: 'gfs_seamless', label: 'GFS' },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS' },
  { id: 'icon_seamless', label: 'ICON' },
  { id: 'gem_seamless', label: 'GEM' },
  { id: 'ecmwf_aifs025_single', label: 'AIFS' },
];

/** Clustered GEFS: control/mean + ~10 members. Deep uses the full set. */
export const CLUSTER_MEMBERS = [
  'control',
  'member03',
  'member06',
  'member09',
  'member12',
  'member15',
  'member18',
  'member21',
  'member24',
  'member27',
  'member30',
];

const cache = new Map();

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function buildGrid(bbox) {
  let { west, south, east, north } = bbox;
  west = clamp(west, -180, 180);
  east = clamp(east, -180, 180);
  south = clamp(south, -90, 90);
  north = clamp(north, -90, 90);
  if (east < west) [west, east] = [east, west];
  if (north < south) [south, north] = [south, north];
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

async function omFetch(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`open-meteo ${res.status}: ${text.slice(0, 220)}`);
  }
  const body = await res.json();
  return Array.isArray(body) ? body : [body];
}

function memberIdsFromHourly(hourly) {
  const ids = new Set();
  for (const k of Object.keys(hourly || {})) {
    if (k === 'wind_speed_10m') ids.add('control');
    else if (k.startsWith('wind_speed_10m_member')) ids.add(k.slice('wind_speed_10m_'.length));
  }
  return [...ids];
}

function seriesAt(hourly, kind, member, i) {
  const key = member === 'control' ? kind : `${kind}_${member}`;
  const v = hourly[key]?.[i];
  return v == null || !Number.isFinite(v) ? null : v;
}

function parseEnsemble(payloads, modelId) {
  const times = payloads[0]?.hourly?.time || [];
  const cells = [];
  const memberSet = new Set();
  for (const loc of payloads) {
    const hourly = loc.hourly || {};
    const members = memberIdsFromHourly(hourly);
    for (const m of members) memberSet.add(m);
    const values = {};
    for (const m of members) {
      const series = [];
      for (let i = 0; i < times.length; i++) {
        const tws = seriesAt(hourly, 'wind_speed_10m', m, i);
        const twd = seriesAt(hourly, 'wind_direction_10m', m, i);
        series.push(tws == null || twd == null ? null : { tws, twd });
      }
      values[`${modelId}:${m}`] = series;
    }
    cells.push({ lat: loc.latitude, lon: loc.longitude, values });
  }
  return { times, cells, members: [...memberSet].map((m) => `${modelId}:${m}`) };
}

function parseModels(payloads) {
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
            : { tws, twd },
        );
      }
      values[m.id] = series;
    }
    cells.push({ lat: loc.latitude, lon: loc.longitude, values });
  }
  return { times, cells };
}

function parseWaves(payloads) {
  const times = payloads[0]?.hourly?.time || [];
  const cells = [];
  for (const loc of payloads) {
    const hs = loc.hourly?.wave_height || [];
    cells.push({
      lat: loc.latitude,
      lon: loc.longitude,
      hs: times.map((_, i) => (Number.isFinite(hs[i]) ? hs[i] : null)),
    });
  }
  return { times, cells };
}

function nearest(cells, lat, lon) {
  let best = cells[0];
  let bestD = Infinity;
  for (const c of cells) {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function timeIndex(times, tHours, fetchedAt) {
  if (!times.length) return 0;
  const start = Date.parse(times[0]);
  if (!Number.isFinite(start)) return 0;
  const target = (Number.isFinite(Date.parse(fetchedAt)) ? Date.parse(fetchedAt) : Date.now()) + tHours * 3600 * 1000;
  let i = 0;
  for (let k = 0; k < times.length; k++) {
    if (Date.parse(times[k]) <= target) i = k;
  }
  return i;
}

function spreadOf(samples) {
  const tws = samples.map((s) => s.tws).filter((n) => n != null);
  const twd = samples.map((s) => s.twd).filter((n) => n != null);
  if (tws.length < 2) return 0;
  const mean = tws.reduce((a, b) => a + b, 0) / tws.length;
  const spd = mean > 0.5 ? stdev(tws) / mean : 0;
  const dir = circStd(twd) / 60;
  return clamp(Math.max(spd, dir), 0, 1);
}

export function clusterIds(allKeys, deep) {
  if (deep) return allKeys;
  const gefs = allKeys.filter((k) => k.startsWith('gfs025:'));
  const wanted = new Set(CLUSTER_MEMBERS.map((m) => `gfs025:${m}`));
  const picked = gefs.filter((k) => wanted.has(k));
  return picked.length ? picked : gefs.slice(0, 11);
}

export async function loadWind({ start, dest, deep }) {
  const bbox = padBbox(start, dest);
  const { latList, lonList, step } = buildGrid(bbox);
  const key = `${deep ? 'd' : 'c'}|${step}|${latList.join(',')}|${lonList.join(',')}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.field;

  const lat = latList.join(',');
  const lon = lonList.join(',');
  const common = {
    latitude: lat,
    longitude: lon,
    cell_selection: 'sea',
    timezone: 'UTC',
    forecast_hours: String(FORECAST_HOURS),
  };

  const ensParams = (model) =>
    new URLSearchParams({
      ...common,
      hourly: 'wind_speed_10m,wind_direction_10m',
      models: model,
      wind_speed_unit: 'kn',
    });
  const modelQs = new URLSearchParams({
    ...common,
    hourly: 'wind_speed_10m,wind_direction_10m',
    models: MODELS.map((m) => m.id).join(','),
    wind_speed_unit: 'kn',
  });
  const waveQs = new URLSearchParams({
    ...common,
    hourly: 'wave_height',
    cell_selection: 'sea',
  });

  // One ensemble model per call so Open-Meteo keeps unprefixed member keys.
  const fetches = [
    omFetch(`${ENSEMBLE_URL}?${ensParams('gfs025')}`),
    omFetch(`${FORECAST_URL}?${modelQs}`),
    omFetch(`${MARINE_URL}?${waveQs}`),
  ];
  if (deep) fetches.push(omFetch(`${ENSEMBLE_URL}?${ensParams('ecmwf_ifs025')}`));
  const [gfsBody, modelBody, waveBody, ecmBody] = await Promise.all(fetches);

  const ens = parseEnsemble(gfsBody, 'gfs025');
  const ecm = deep && ecmBody ? parseEnsemble(ecmBody, 'ecmwf_ifs025') : { members: [], cells: [] };
  const models = parseModels(modelBody);
  const waves = parseWaves(waveBody);
  const fetchedAt = new Date().toISOString();

  const ensMembers = [...new Set([...ens.members, ...ecm.members])];
  const cells = ens.cells.map((c, i) => ({
    lat: c.lat,
    lon: c.lon,
    ens: { ...c.values, ...(ecm.cells[i]?.values || {}) },
    models: models.cells[i]?.values || {},
    hs: waves.cells[i]?.hs || [],
  }));

  const field = {
    cellSelection: 'sea',
    step,
    fetchedAt,
    times: ens.times.length ? ens.times : models.times,
    ensMembers,
    usedMembers: clusterIds(ensMembers, deep),
    deep: !!deep,
    gribFallback: false,
    openMeteo: {
      ensemble: deep ? 'gfs025+ecmwf_ifs025' : 'gfs025',
      models: MODELS.map((m) => m.id).join(','),
      cell_selection: 'sea',
    },
    cells,
    sample(lat, lon, tHours) {
      return sampleField(field, lat, lon, tHours);
    },
    spot(lat, lon) {
      const c = nearest(cells, lat, lon);
      const i = 0;
      const ctrl = c.ens['gfs025:control']?.[i] || c.ens[Object.keys(c.ens)[0]]?.[i];
      return {
        lat: c.lat,
        lon: c.lon,
        time: field.times[i],
        model: 'gfs025',
        member: 'control',
        tws: ctrl?.tws ?? null,
        twd: ctrl?.twd ?? null,
        cellSelection: 'sea',
      };
    },
  };
  cache.set(key, { at: now, field });
  return field;
}

function sampleField(field, lat, lon, tHours) {
  const c = nearest(field.cells, lat, lon);
  const i = timeIndex(field.times, tHours, field.fetchedAt);
  const used = field.usedMembers;
  const ensSamples = [];
  for (const k of used) {
    const s = c.ens[k]?.[i];
    if (s) ensSamples.push(s);
  }
  const modelSamples = [];
  for (const m of MODELS) {
    const s = c.models[m.id]?.[i];
    if (s) modelSamples.push(s);
  }
  const control = c.ens['gfs025:control']?.[i] || ensSamples[0] || modelSamples[0];
  const modelMean = meanSample(modelSamples) || control;
  const hs = c.hs[i] ?? null;
  const p90 = quantile(ensSamples.map((s) => s.tws), 0.9);
  return {
    tws: control?.tws ?? null,
    twd: control?.twd ?? null,
    modelTws: modelMean?.tws ?? null,
    modelTwd: modelMean?.twd ?? null,
    ensSpread: spreadOf(ensSamples),
    modelSpread: spreadOf(modelSamples),
    p90Tws: p90,
    hs,
    members: Object.fromEntries(used.map((k) => [k, c.ens[k]?.[i] || null])),
    models: Object.fromEntries(MODELS.map((m) => [m.id, c.models[m.id]?.[i] || null])),
  };
}

function meanSample(samples) {
  if (!samples.length) return null;
  const tws = samples.reduce((a, s) => a + s.tws, 0) / samples.length;
  const twd = circMean(samples.map((s) => s.twd));
  return { tws, twd };
}

export { padBbox };
