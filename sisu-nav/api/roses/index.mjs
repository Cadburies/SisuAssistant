/** Wind roses from this boat’s Influx Sisu_1m (#86). Browser never holds the token. */
import { aggregate } from './aggregate.mjs';
import { influxAuth, queryFlux } from './influx.mjs';
import { BINS, CALM_MAX, GEOHASH_PRECISION, MIN_CELL_SAMPLES, N_PETALS } from './spec.mjs';
import { communityConfigured, listCommunity, shareRoses } from './community.mjs';
import { listSpots, runCycle, setBerths, setCommunityOptIn, shareCommunity, syncNow } from './anchor-store.mjs';

const BUCKET = process.env.INFLUXDB_ROSES_BUCKET || 'Sisu_1m';
const TTL_MS = 60 * 1000;
const cache = new Map();

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        req.destroy();
        reject(Object.assign(new Error('body too large'), { status: 413 }));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(Object.assign(new Error('invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function windowOf(url) {
  const kind = url.searchParams.get('kind') || 'days';
  if (kind === 'monthOfYear') {
    const month = Number(url.searchParams.get('month'));
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw Object.assign(new Error('month 1–12 required'), { status: 400 });
    }
    return { kind, month, range: '-5y', fluxMonth: month };
  }
  const n = Number(url.searchParams.get('n') || (kind === 'months' ? 1 : 7));
  if (kind === 'months') {
    const months = [1, 3, 12].includes(n) ? n : 1;
    const days = months === 12 ? 365 : months * 30;
    return { kind: 'months', n: months, range: `-${days}d` };
  }
  const days = [1, 7, 30].includes(n) ? n : 7;
  return { kind: 'days', n: days, range: `-${days}d` };
}

function numParam(url, name) {
  const s = url.searchParams.get(name);
  if (s == null || s === '') return NaN;
  return Number(s);
}

function bboxOf(url) {
  const west = numParam(url, 'west');
  const south = numParam(url, 'south');
  const east = numParam(url, 'east');
  const north = numParam(url, 'north');
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return { west, south, east, north };
}

function fluxFor(win) {
  const monthFilter = win.fluxMonth
    ? `import "date"\n` +
      `from(bucket: "${BUCKET}")\n` +
      `  |> range(start: ${win.range})\n` +
      `  |> filter(fn: (r) => date.month(t: r._time) == ${win.fluxMonth})\n`
    : `from(bucket: "${BUCKET}")\n` + `  |> range(start: ${win.range})\n`;
  return (
    monthFilter +
    `  |> filter(fn: (r) => r._field == "value")\n` +
    `  |> filter(fn: (r) => r._measurement == "sensor.nmea_twd" or r._measurement == "sensor.nmea_aws" or r._measurement == "sensor.nmea_latitude" or r._measurement == "sensor.nmea_longitude")\n` +
    `  |> keep(columns: ["_time", "_measurement", "_value"])\n`
  );
}

export async function handle(req, res, url) {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
      });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/api/roses/community') {
      const bbox = bboxOf(url) || {};
      return json(res, 200, await listCommunity({ ...bbox, month: url.searchParams.get('month') }));
    }
    if (req.method === 'POST' && url.pathname === '/api/roses/share') {
      const body = await readJson(req);
      return json(res, 200, await shareRoses(body));
    }
    if (req.method === 'GET' && url.pathname === '/api/roses/anchor-spots') {
      return json(res, 200, { ...listSpots(), spec: { bins: BINS, petals: N_PETALS, calmMax: CALM_MAX } });
    }
    if (req.method === 'POST' && url.pathname === '/api/roses/anchor-spots/run') {
      const run = await runCycle();
      const doSync = url.searchParams.get('sync') === '1';
      const sync = doSync ? await syncNow() : undefined;
      const community = doSync ? await shareCommunity() : undefined;
      return json(res, 200, { run, sync, community, ...listSpots() });
    }
    if (req.method === 'POST' && url.pathname === '/api/roses/anchor-spots/settings') {
      const body = await readJson(req);
      if ('berths' in body) setBerths(body.berths);
      return json(res, 200, listSpots());
    }
    if (req.method === 'POST' && url.pathname === '/api/roses/anchor-spots/community') {
      const body = await readJson(req);
      const st = setCommunityOptIn(body.optIn);
      return json(res, 200, { status: st, community: st.communityOptIn ? await shareCommunity() : undefined });
    }
    if (req.method === 'GET' && url.pathname === '/api/roses/spec') {
      return json(res, 200, {
        bins: BINS,
        petals: N_PETALS,
        calmMax: CALM_MAX,
        pairing: { direction: 'sensor.nmea_twd', speed: 'sensor.nmea_aws' },
        bucket: BUCKET,
        geohash: GEOHASH_PRECISION,
        minCellSamples: MIN_CELL_SAMPLES,
        community: communityConfigured(),
      });
    }
    if (!(req.method === 'GET' && url.pathname === '/api/roses')) {
      return json(res, 404, { error: 'unknown roses route' });
    }
    const { token } = influxAuth();
    if (!token) return json(res, 503, { error: 'INFLUXDB_TOKEN unset' });
    const win = windowOf(url);
    const bbox = bboxOf(url);
    const key = JSON.stringify({ win, bbox });
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && now - hit.at < TTL_MS) {
      return json(res, 200, { ...hit.payload, cached: true });
    }
    const series = await queryFlux(fluxFor(win));
    const agg = aggregate(series, bbox);
    const payload = {
      window: win,
      bucket: BUCKET,
      pairing: { direction: 'sensor.nmea_twd', speed: 'sensor.nmea_aws' },
      spec: { bins: BINS, petals: N_PETALS, calmMax: CALM_MAX, geohash: GEOHASH_PRECISION },
      joined: agg.joined,
      skippedNoPos: agg.skippedNoPos,
      raw: { twd: agg.rawTwd, aws: agg.rawAws },
      cellCount: agg.cells.length,
      cells: agg.cells,
      cached: false,
    };
    cache.set(key, { at: now, payload });
    return json(res, 200, payload);
  } catch (err) {
    const status = err?.status || 500;
    return json(res, status, { error: err instanceof Error ? err.message : String(err) });
  }
}
