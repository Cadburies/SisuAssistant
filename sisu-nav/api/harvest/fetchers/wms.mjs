/**
 * WMS GetMap harvester (#99 GEBCO). Each slippy tile is a 256×256
 * EPSG:3857 GetMap of that tile's Web Mercator bbox. No third-party
 * GEBCO XYZ cache. No GDAL.
 */
import path from 'node:path';
import { tileGrid } from '../grid.mjs';
import { openMbtiles } from '../mbtiles.mjs';
import { fetchBuffer, isProbablyTile } from './http.mjs';

const ORIGIN = 20037508.342789244;

export function xyzTo3857(z, x, y) {
  const n = 2 ** z;
  const minx = (x / n) * 2 * ORIGIN - ORIGIN;
  const maxx = ((x + 1) / n) * 2 * ORIGIN - ORIGIN;
  const maxy = ORIGIN - (y / n) * 2 * ORIGIN;
  const miny = ORIGIN - ((y + 1) / n) * 2 * ORIGIN;
  return [minx, miny, maxx, maxy];
}

function wmsUrl(provider, z, x, y) {
  const [minx, miny, maxx, maxy] = xyzTo3857(z, x, y);
  const base = (provider.wms || provider.template || '').replace(/\?$/, '');
  const layer = provider.layer;
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: layer,
    CRS: 'EPSG:3857',
    BBOX: `${minx},${miny},${maxx},${maxy}`,
    WIDTH: String(provider.tileSize || 256),
    HEIGHT: String(provider.tileSize || 256),
    FORMAT: provider.wmsFormat || 'image/png',
    TRANSPARENT: 'TRUE',
    STYLES: '',
  });
  return `${base}?${params.toString()}`;
}

export async function runWms({ job, provider, outDir, onProgress }) {
  const tiles = tileGrid(job.bbox, job.minZoom, job.maxZoom);
  const file = path.join(outDir, `${job.providerId}.mbtiles`);
  const mb = openMbtiles(file, {
    name: provider.label,
    format: provider.format || 'png',
    bounds: job.bbox,
    minzoom: job.minZoom,
    maxzoom: job.maxZoom,
    attribution: provider.attribution,
    description: `${provider.label} — ${job.region}`,
    tilesize: provider.tileSize || 256,
  });
  let fetched = 0;
  let completed = 0;
  let failed = 0;
  let tileCount = 0;
  try {
    for (const { z, x, y } of tiles) {
      if (!mb.hasTile(z, x, y)) {
        try {
          const buf = await fetchBuffer(wmsUrl(provider, z, x, y));
          if (!isProbablyTile(buf)) {
            failed += 1;
            console.warn(`[harvest] wms ${z}/${x}/${y} not an image (${buf.length} B) — not stored`);
          } else if (mb.putTile(z, x, y, buf)) {
            fetched += 1;
          }
        } catch (err) {
          failed += 1;
          console.warn(`[harvest] wms ${z}/${x}/${y} failed: ${err instanceof Error ? err.message : err}`);
        }
      }
      completed += 1;
      if (completed % 20 === 0 || completed === tiles.length) onProgress(completed, fetched, failed);
    }
    tileCount = mb.countAll();
  } finally {
    mb.close();
  }
  return { completed, total: tiles.length, fetched, failed, tileCount };
}
