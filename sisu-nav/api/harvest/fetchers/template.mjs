/**
 * Generic {z}/{x}/{y}-template tile harvester shared by every provider whose
 * WMTS/XYZ endpoint is just URL substitution (EOX, GIBS, Esri). Provider-
 * specific extra placeholders (GIBS's {layer}/{time}) are passed in `extra`.
 */
import path from 'node:path';
import { tileGrid } from '../grid.mjs';
import { createMbtiles } from '../mbtiles.mjs';
import { fetchBuffer } from './http.mjs';

export async function runTemplateHarvest({ job, provider, outDir, onProgress }, extra = {}) {
  const tiles = tileGrid(job.bbox, job.minZoom, job.maxZoom);
  const file = path.join(outDir, `${job.providerId}.mbtiles`);
  const mb = createMbtiles(file, {
    name: provider.label,
    format: provider.format,
    bounds: job.bbox,
    minzoom: job.minZoom,
    maxzoom: job.maxZoom,
    attribution: provider.attribution,
    description: `${provider.label} — ${job.region}`,
  });

  let completed = 0;
  try {
    for (const { z, x, y } of tiles) {
      if (!mb.hasTile(z, x, y)) {
        let url = provider.template
          .replaceAll('{z}', String(z))
          .replaceAll('{x}', String(x))
          .replaceAll('{y}', String(y));
        for (const [k, v] of Object.entries(extra)) url = url.replaceAll(`{${k}}`, String(v));
        const buf = await fetchBuffer(url);
        mb.putTile(z, x, y, buf);
      }
      completed += 1;
      if (completed % 20 === 0 || completed === tiles.length) onProgress(completed);
    }
  } finally {
    mb.close();
  }
  return { completed, total: tiles.length };
}
