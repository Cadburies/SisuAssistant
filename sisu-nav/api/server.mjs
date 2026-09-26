#!/usr/bin/env node
/**
 * Static SPA host + tile catalog. Live nav data is browser → Signal K WS.
 * Weather overlay API lives in ./weather (#77); dated tile harvest lives in
 * ./harvest (#80); isochrone routing lives in ./route (#78); wind roses
 * from Influx live in ./roses (#86); ECMWF ENS spaghetti lives in
 * ./ensemble (#91); global AIS (AISStream.io) lives in ./ais-global (#115);
 * anchoring hazards (submarine cables) live in ./hazards (#118); Google
 * live-basemap session brokering lives in ./basemaps (#116); Azure Maps
 * imagery is a config token like Mapbox (#126); marine waves / swell live
 * in ./marine (#94) — notes stay out.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle as handleWeather } from './weather/index.mjs';
import { handle as handleHarvest } from './harvest/index.mjs';
import { handle as handleRoute } from './route/index.mjs';
import { handle as handleRoses } from './roses/index.mjs';
import { handle as handleEnsemble } from './ensemble/index.mjs';
import { handle as handleAisGlobal } from './ais-global/index.mjs';
import { handle as handleHazards } from './hazards/index.mjs';
import { handle as handleBasemaps } from './basemaps/index.mjs';
import { handle as handleMarine } from './marine/index.mjs';
import { handle as handlePois } from './pois/index.mjs';
import { handle as handleAircraft } from './aircraft/index.mjs';
import { handle as handleSatellites } from './satellites/index.mjs';
import { handle as handleSettings } from './settings/index.mjs';

const PORT = Number(process.env.SISU_NAV_PORT || process.env.PORT || 8088);
const TILES = process.env.SISU_TILES_DIR || '/data/tiles';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(data);
}

function listTilesets(root) {
  const out = [];
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full, r);
      else if (/\.(mbtiles|pmtiles)$/i.test(ent.name)) {
        const ext = path.extname(ent.name).slice(1).toLowerCase();
        const id = r.replace(/\.(mbtiles|pmtiles)$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_');
        // First path segment under TILES is the kind (satellite/nautical/
        // bathymetry/manual, #97) — MapView's applyTilesets uses this to
        // keep bathymetry rasters from auto-painting as satellite photos.
        let kind = r.split('/')[0] || 'manual';
        let mtimeMs = 0;
        let bytes = 0;
        try {
          const st = fs.statSync(full);
          mtimeMs = Math.round(st.mtimeMs);
          bytes = st.size;
        } catch {
          /* skip stats */
        }
        let label;
        let imported = kind === 'manual';
        let tileSize;
        try {
          const meta = JSON.parse(fs.readFileSync(path.join(path.dirname(full), 'meta.json'), 'utf8'));
          if (meta.kind) kind = meta.kind;
          label = meta.providerLabel || meta.label;
          if (meta.tileSize) tileSize = Number(meta.tileSize);
          if (meta.imported) imported = true;
        } catch {
          /* harvest trees have meta.json one level up; ignore if absent */
        }
        out.push({ id, file: r, format: ext, kind, mtimeMs, bytes, label, imported, tileSize });
      }
    }
  };
  walk(root, '');
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function hostOf(req) {
  const raw = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return String(raw).split(',')[0].trim().split(':')[0];
}

function safePublicFile(urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return null;
  return file;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    return json(res, 200, { ok: true, service: 'sisu-nav-api' });
  }
  if (url.pathname === '/api/config') {
    const host = hostOf(req);
    // mapboxToken: intentionally client-exposed — Mapbox `pk.` tokens are public
    // tile tokens protected by URL restriction, not secrecy (#116). The Azure
    // Maps subscription key is an account secret: only a boolean goes out and
    // tiles are proxied by /api/basemaps/azure/{z}/{x}/{y} (#168).
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    const azureMapsKey = process.env.AZURE_MAPS_SUBSCRIPTION_KEY;
    // googleConfigured: cheap presence check only. The actual session POST
    // happens lazily via GET /api/basemaps/google when that layer is on.
    const isSet = (v) => Boolean(v) && v !== 'CHANGE_ME';
    return json(res, 200, {
      signalkHttp: process.env.SIGNALK_URL || `http://${host}:3000`,
      tileserver: process.env.TILESERVER_URL || `http://${host}:8087`,
      mapboxToken: isSet(mapboxToken) ? mapboxToken : null,
      googleConfigured: isSet(process.env.GOOGLE_MAPS_API_KEY),
      azureConfigured: isSet(azureMapsKey),
    });
  }
  if (url.pathname === '/api/tilesets') {
    return json(res, 200, { tilesets: listTilesets(TILES) });
  }
  if (url.pathname.startsWith('/api/weather')) {
    return handleWeather(req, res, url);
  }
  if (url.pathname.startsWith('/api/harvest')) {
    return handleHarvest(req, res, url);
  }
  if (url.pathname.startsWith('/api/route')) {
    return handleRoute(req, res, url);
  }
  if (url.pathname.startsWith('/api/roses')) {
    return handleRoses(req, res, url);
  }
  if (url.pathname.startsWith('/api/ensemble')) {
    return handleEnsemble(req, res, url);
  }
  if (url.pathname.startsWith('/api/ais-global')) {
    return handleAisGlobal(req, res, url);
  }
  if (url.pathname.startsWith('/api/hazards')) {
    return handleHazards(req, res, url);
  }
  if (url.pathname.startsWith('/api/basemaps')) {
    return handleBasemaps(req, res, url);
  }
  if (url.pathname.startsWith('/api/pois')) {
    return handlePois(req, res, url);
  }
  if (url.pathname.startsWith('/api/aircraft')) {
    return handleAircraft(req, res, url);
  }
  if (url.pathname.startsWith('/api/satellites')) {
    return handleSatellites(req, res, url);
  }
  if (url.pathname.startsWith('/api/marine')) {
    return handleMarine(req, res, url);
  }
  if (url.pathname.startsWith('/api/settings')) {
    return handleSettings(req, res, url);
  }

  let file = safePublicFile(url.pathname);
  if (!file) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    file = path.join(PUBLIC, 'index.html');
    try {
      stat = fs.statSync(file);
    } catch {
      res.writeHead(404);
      return res.end('not found');
    }
  }
  if (stat.isDirectory()) file = path.join(PUBLIC, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('not found');
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`sisu-nav-api listening on ${PORT} tiles=${TILES}`);
});
