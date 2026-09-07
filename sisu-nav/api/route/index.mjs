/** HTTP routes for isochrone planning (#78). Mounted at /api/route by ../server.mjs. */
import crypto from 'node:crypto';
import { evaluateMembers, MODES, planIsochrone } from './isochrone.mjs';
import { landStats, weatherRoutingSpike } from './land.mjs';
import { listPolars, loadPolar, POLAR_WARNING } from './polar.mjs';
import { listRoutes, putRoute, routeRecord, skBase, skToken } from './sk.mjs';
import { CLUSTER_MEMBERS, loadWind } from './wind.mjs';

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(data);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error('request body too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function pt(v, label) {
  const lat = Number(v?.lat);
  const lon = Number(v?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw Object.assign(new Error(`${label} lat/lon required`), { status: 400 });
  }
  return { lat, lon };
}

function corridorGeoJSON(plan) {
  const features = [
    {
      type: 'Feature',
      properties: { kind: 'route' },
      geometry: { type: 'LineString', coordinates: plan.coordinates },
    },
  ];
  for (const iso of plan.isochrones || []) {
    if ((iso.coordinates || []).length < 2) continue;
    features.push({
      type: 'Feature',
      properties: { kind: 'isochrone', tHours: iso.tHours },
      geometry: { type: 'LineString', coordinates: iso.coordinates },
    });
  }
  features.push({
    type: 'Feature',
    properties: { kind: 'dest' },
    geometry: { type: 'Point', coordinates: [plan.dest.lon, plan.dest.lat] },
  });
  return { type: 'FeatureCollection', features };
}

export async function handle(req, res, url) {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
      });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/api/route/modes') {
      return json(res, 200, {
        modes: MODES,
        clusterMembers: CLUSTER_MEMBERS,
        polarWarning: POLAR_WARNING,
        cellSelection: 'sea',
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/route/polars') {
      return json(res, 200, { polars: listPolars(), warning: POLAR_WARNING });
    }
    if (req.method === 'GET' && url.pathname === '/api/route/committed') {
      const token = await skToken(req);
      if (!token) return json(res, 401, { error: 'Signal K token required' });
      const routes = await listRoutes(token);
      return json(res, 200, { routes, via: 'api→SK REST' });
    }
    if (req.method === 'POST' && url.pathname === '/api/route/plan') {
      const body = await readJsonBody(req);
      const mode = MODES.some((m) => m.id === body.mode) ? body.mode : 'eta';
      const start = pt(body.start, 'start');
      const dest = pt(body.dest, 'dest');
      const deep = !!body.deep;
      const polar = loadPolar(body.polar || 'generic-cruising');
      const maxTws = body.maxTws == null || body.maxTws === '' ? 30 : Number(body.maxTws);
      const maxHs = body.maxHs == null || body.maxHs === '' ? 3 : Number(body.maxHs);
      const wind = await loadWind({ start, dest, deep });
      const plan = planIsochrone({
        start,
        dest,
        polar,
        wind,
        mode,
        maxTws: Number.isFinite(maxTws) ? maxTws : 30,
        maxHs: Number.isFinite(maxHs) ? maxHs : 3,
        dtHours: body.dtHours,
        maxHours: body.maxHours,
      });
      const evald = evaluateMembers({
        wind,
        polar,
        coords: plan.coordinates,
        mode,
        maxTws: Number.isFinite(maxTws) ? maxTws : 30,
        maxHs: Number.isFinite(maxHs) ? maxHs : 3,
      });
      let wr;
      try {
        wr = await weatherRoutingSpike(await skBase(), await skToken(req).catch(() => ''));
      } catch {
        wr = { tried: false, installed: false };
      }
      return json(res, 200, {
        mode,
        modes: MODES,
        deep,
        polar: { id: polar.id, warning: polar.warning },
        polarWarning: polar.warning,
        cellSelection: 'sea',
        gribFallback: false,
        gdal: false,
        land: { ...landStats(), weatherRouting: wr },
        membersUsed: wind.usedMembers,
        openMeteo: wind.openMeteo,
        fetchedAt: wind.fetchedAt,
        spotCheck: wind.spot(start.lat, start.lon),
        etaHours: plan.etaHours,
        distanceNm: plan.distanceNm,
        arrived: plan.arrived,
        etaHistogram: evald.histogram,
        p90Tws: evald.p90Tws,
        etaP50: evald.etaP50,
        start: plan.start,
        dest: plan.dest,
        route: { coordinates: plan.coordinates, distanceNm: plan.distanceNm, etaHours: plan.etaHours },
        corridor: corridorGeoJSON(plan),
        advisory: true,
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/route/commit') {
      const body = await readJsonBody(req);
      const coords = body.coordinates || body.route?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) {
        return json(res, 400, { error: 'route coordinates required' });
      }
      const token = await skToken(req);
      if (!token) return json(res, 401, { error: 'Signal K token required for commit' });
      const id = body.id || crypto.randomUUID();
      const record = routeRecord({
        name: body.name,
        description: body.description,
        coordinates: coords,
        distanceNm: Number(body.distanceNm) || 0,
        mode: body.mode || 'eta',
        polar: body.polar || 'generic-cruising',
      });
      const saved = await putRoute(token, id, record);
      return json(res, 200, { id, saved, via: 'api→SK REST', record });
    }
    return json(res, 404, { error: 'unknown route endpoint' });
  } catch (err) {
    const status = err?.status || 500;
    return json(res, status, { error: err instanceof Error ? err.message : String(err) });
  }
}
