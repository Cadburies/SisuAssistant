#!/usr/bin/env node
/**
 * Static SPA host + tile catalog. Live nav data is browser → Signal K WS.
 * Weather overlay API lives in ./weather (#77); dated tile harvest lives in
 * ./harvest (#80); isochrone routing lives in ./route (#78); wind roses
 * from Influx live in ./roses (#86) — notes stay out.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle as handleWeather } from './weather/index.mjs';
import { handle as handleHarvest } from './harvest/index.mjs';
import { handle as handleRoute } from './route/index.mjs';
import { handle as handleRoses } from './roses/index.mjs';

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
        out.push({ id, file: r, format: ext });
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
    return json(res, 200, {
      signalkHttp: process.env.SIGNALK_URL || `http://${host}:3000`,
      tileserver: process.env.TILESERVER_URL || `http://${host}:8087`,
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
