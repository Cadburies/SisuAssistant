/**
 * Generic {z}/{x}/{y}-template tile harvester shared by every provider whose
 * WMTS/XYZ endpoint is just URL substitution (EOX, GIBS, Esri). Provider-
 * specific extra placeholders (GIBS's {layer}/{time}) are passed in `extra`.
 */
import path from 'node:path';
import { tileGrid } from '../grid.mjs';
import { openMbtiles } from '../mbtiles.mjs';
import { fetchBuffer } from './http.mjs';

export async function runTemplateHarvest({ job, provider, outDir, onProgress }, extra = {}) {
  const tiles = tileGrid(job.bbox, job.minZoom, job.maxZoom);
  const file = path.join(outDir, `${job.providerId}.mbtiles`);
  const mb = openMbtiles(file, {
    name: provider.label,
    format: provider.format,
    bounds: job.bbox,
    minzoom: job.minZoom,
    maxzoom: job.maxZoom,
    attribution: provider.attribution,
    description: `${provider.label} — ${job.region}`,
  });

  let fetched = 0;
  let completed = 0;
  let failed = 0;
  let tileCount = 0;
  try {
    for (const { z, x, y } of tiles) {
      if (!mb.hasTile(z, x, y)) {
        let url = provider.template
          .replaceAll('{z}', String(z))
          .replaceAll('{x}', String(x))
          .replaceAll('{y}', String(y));
        for (const [k, v] of Object.entries(extra)) url = url.replaceAll(`{${k}}`, String(v));
        // One tile with no coverage (404) or a transient fetch error must not
        // sink the whole batch (#110) — every tile after it in iteration
        // order would otherwise never even be attempted, and a retry hits
        // the same tile first and aborts at the same spot every time. Skip
        // it (it stays "missing" — hasTile() will retry it next harvest)
        // and keep going.
        try {
          const buf = await fetchBuffer(url);
          mb.putTile(z, x, y, buf);
          fetched += 1;
        } catch (err) {
          failed += 1;
          console.warn(`[harvest] tile ${z}/${x}/${y} failed: ${err instanceof Error ? err.message : err}`);
        }
      }
      completed += 1;
      if (completed % 20 === 0 || completed === tiles.length) onProgress(completed, fetched);
    }
    tileCount = mb.countAll();
  } finally {
    mb.close();
  }
  return { completed, total: tiles.length, fetched, failed, tileCount };
}
