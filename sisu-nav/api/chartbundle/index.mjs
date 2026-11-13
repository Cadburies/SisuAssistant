/**
 * Serve the Poseidon style, sprite, and outline files beside a manual
 * MBTiles archive. tileserver-gl serves the archive only. Paths stay
 * inside that archive's directory.
 */
import fs from 'node:fs';
import path from 'node:path';

const PARTS = new Set(['style', 'sprite.json', 'sprite.png', 'coverage.geojson', 'regions.geojson']);

function tilesetId(rel) {
  return rel.replace(/\.(mbtiles|pmtiles)$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_');
}

function readMeta(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** The archive directory for a tileset id, or null. */
export function findArchiveDir(tilesRoot, id) {
  const wanted = String(id || '');
  if (!wanted || wanted.includes('..') || wanted.includes('/') || wanted.includes('\\')) return null;
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const ent of entries) {
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const hit = walk(full, r);
        if (hit) return hit;
      } else if (/\.(mbtiles|pmtiles)$/i.test(ent.name) && tilesetId(r) === wanted) {
        return dir;
      }
    }
    return null;
  };
  return walk(tilesRoot, '');
}

/**
 * Absolute path of one bundle file, or null when it would leave the
 * archive directory. `part` is `style`, `sprite.json`, `sprite.png`,
 * `coverage.geojson`, or `regions.geojson`.
 */
export function bundleFile(tilesRoot, id, part) {
  if (!PARTS.has(part)) return null;
  const dir = findArchiveDir(tilesRoot, id);
  if (!dir) return null;
  const meta = readMeta(dir) || {};
  let name;
  if (part === 'coverage.geojson' || part === 'regions.geojson') name = part;
  else if (part === 'style') name = typeof meta.style === 'string' ? meta.style : 'style.json';
  else if (part === 'sprite.json') {
    const stem = typeof meta.sprite === 'string' ? meta.sprite : 'sprite';
    name = stem.endsWith('.json') ? stem : `${stem}.json`;
  } else {
    const stem = typeof meta.sprite === 'string' ? meta.sprite : 'sprite';
    name = stem.endsWith('.png') ? stem : `${stem}.png`;
  }
  if (name.includes('..') || path.isAbsolute(name) || name.includes('/') || name.includes('\\')) return null;
  const root = fs.realpathSync(tilesRoot);
  const archiveDir = fs.realpathSync(dir);
  if (archiveDir !== root && !archiveDir.startsWith(root + path.sep)) return null;
  const file = path.join(archiveDir, name);
  let real;
  try {
    real = fs.realpathSync(file);
  } catch {
    return null;
  }
  if (real !== archiveDir && !real.startsWith(archiveDir + path.sep)) return null;
  return real;
}

function send(res, file) {
  const ext = path.extname(file);
  const type = ext === '.png' ? 'image/png' : 'application/json; charset=utf-8';
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  fs.createReadStream(file).pipe(res);
}

/** `{id, part}` from a chartbundle path, or null when the encoding is broken. */
export function chartbundlePath(pathname) {
  let rest;
  try {
    rest = decodeURIComponent(String(pathname).slice('/api/chartbundle/'.length));
  } catch {
    return null;
  }
  const slash = rest.lastIndexOf('/');
  if (slash < 0) return null;
  return { id: rest.slice(0, slash), part: rest.slice(slash + 1) };
}

export function handle(req, res, url, tilesRoot) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end('{"error":"method"}');
    return;
  }
  const parsed = chartbundlePath(url.pathname);
  if (!parsed) {
    res.writeHead(404, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end('{"error":"not found"}');
    return;
  }
  const { id, part } = parsed;
  const file = bundleFile(tilesRoot, id, part);
  if (!file) {
    res.writeHead(404, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end('{"error":"not found"}');
    return;
  }
  send(res, file);
}
