import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Tileset } from '../../app/config';

const PREFIX = 'imported-';

function tilesetRev(ts: Tileset): string {
  return `${ts.mtimeMs ?? 0}:${ts.bytes ?? 0}`;
}

function bustTileUrl(url: string, rev: string): string {
  const v = encodeURIComponent(rev);
  return url.includes('?') ? `${url}&v=${v}` : `${url}?v=${v}`;
}

function slugOf(ts: Tileset): string | null {
  const m = ts.file.match(/^manual\/([^/]+)\//);
  return m ? m[1] : null;
}

function srcId(ts: Tileset): string {
  return `${PREFIX}${ts.id}`;
}

function remove(map: MapLibreMap, id: string): void {
  if (map.getLayer(`${id}-raster`)) map.removeLayer(`${id}-raster`);
  if (map.getSource(id)) map.removeSource(id);
}

export async function syncImportedOverlay(
  map: MapLibreMap | null,
  tileserver: string,
  listed: Tileset[],
  enabledSlugs: Set<string>,
  seen: Map<string, string>,
): Promise<void> {
  if (!map?.isStyleLoaded()) return;
  // Nautical/satellite imports are the Charts basemap (#127). Only
  // bathymetry-kind drop-ins overlay here, from the Bathymetry panel.
  const wanted = listed.filter((ts) => {
    if (ts.kind !== 'bathymetry') return false;
    if (!ts.imported && !ts.file.startsWith('manual/')) return false;
    const slug = slugOf(ts);
    return Boolean(slug && enabledSlugs.has(slug));
  });
  const wantedIds = new Set(wanted.map((ts) => srcId(ts)));
  for (const id of [...seen.keys()]) {
    if (wantedIds.has(id)) continue;
    remove(map, id);
    seen.delete(id);
  }
  const before = map.getLayer('track-line') ? 'track-line' : undefined;
  for (const ts of wanted) {
    const id = srcId(ts);
    const rev = tilesetRev(ts);
    if (seen.get(id) === rev && map.getSource(id)) continue;
    if (map.getSource(id)) remove(map, id);
    const tilejsonUrl = `${tileserver.replace(/\/$/, '')}/data/${encodeURIComponent(ts.id)}.json`;
    try {
      const res = await fetch(`${tilejsonUrl}?v=${encodeURIComponent(rev)}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const tj = (await res.json()) as {
        tiles?: string[];
        attribution?: string;
        tileSize?: number | string;
        tilesize?: number | string;
        minzoom?: number | string;
        maxzoom?: number | string;
        vector_layers?: unknown[];
        format?: string;
      };
      const attribution = tj.attribution?.trim() || undefined;
      const isVector = Boolean(tj.vector_layers) || tj.format === 'pbf';
      if (isVector) {
        map.addSource(id, {
          type: 'vector',
          url: `${tilejsonUrl}?v=${encodeURIComponent(rev)}`,
          ...(attribution ? { attribution } : {}),
        });
      } else {
        if (!tj.tiles?.length) continue;
        const tileSize = Number(tj.tileSize ?? tj.tilesize ?? ts.tileSize) || 256;
        const minzoom = Number(tj.minzoom);
        const maxzoom = Number(tj.maxzoom);
        map.addSource(id, {
          type: 'raster',
          tiles: tj.tiles.map((u) => bustTileUrl(u, rev)),
          tileSize,
          ...(Number.isFinite(minzoom) ? { minzoom } : {}),
          ...(Number.isFinite(maxzoom) ? { maxzoom } : {}),
          ...(attribution ? { attribution } : {}),
        });
        map.addLayer(
          {
            id: `${id}-raster`,
            type: 'raster',
            source: id,
            paint: { 'raster-opacity': 0.85 },
          },
          before,
        );
      }
      seen.set(id, rev);
    } catch {
      /* tileserver not ready */
    }
  }
}

export function clearImportedOverlay(map: MapLibreMap | null, seen: Map<string, string>): void {
  if (!map) return;
  for (const id of [...seen.keys()]) remove(map, id);
  seen.clear();
}
