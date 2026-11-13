import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Tileset } from '../../app/config';
import { chartOverPhoto } from '../map/poseidonChart';
import { paintPoseidonChart } from '../map/poseidonPaint';

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
  const style = map.getStyle();
  const layers = style?.layers ?? [];
  for (const layer of [...layers].reverse()) {
    const src = 'source' in layer ? layer.source : undefined;
    const owned =
      layer.id === id ||
      layer.id.startsWith(`${id}-`) ||
      src === id ||
      (typeof src === 'string' && src.startsWith(`${id}-`));
    if (owned && map.getLayer(layer.id)) map.removeLayer(layer.id);
  }
  for (const srcId of Object.keys(style?.sources ?? {})) {
    if ((srcId === id || srcId.startsWith(`${id}-`)) && map.getSource(srcId)) map.removeSource(srcId);
  }
}

/** A satellite photo under the chart. OpenStreetMap and paper charts are not photos. */
function imageryUnder(map: MapLibreMap, listed: Tileset[]): boolean {
  return chartOverPhoto({
    livePhoto: Boolean(map.getSource('basemap-live-src')),
    savedSatellite: listed.some((ts) => ts.kind === 'satellite' && Boolean(map.getSource(`local-${ts.id}`))),
    satelliteUnderlay: Boolean(map.getSource('local-satellite-underlay')),
  });
}

export async function syncImportedOverlay(
  map: MapLibreMap | null,
  tileserver: string,
  listed: Tileset[],
  enabledSlugs: Set<string>,
  seen: Map<string, string>,
  current: () => boolean = () => true,
): Promise<void> {
  if (!map?.isStyleLoaded() || !current()) return;
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
  const imagery = imageryUnder(map, listed);
  // A photo can appear while the tile JSON or sprite is loading. `fresh` is
  // false for that older pass, so it does not paint or record `seen`.
  const fresh = () => current() && Boolean(map.isStyleLoaded()) && imageryUnder(map, listed) === imagery;
  for (const ts of wanted) {
    if (!fresh()) return;
    const id = srcId(ts);
    const rev = `${tilesetRev(ts)}|img:${imagery ? 1 : 0}`;
    if (seen.get(id) === rev && map.getSource(id)) continue;
    if (map.getSource(id)) remove(map, id);
    const tilejsonUrl = `${tileserver.replace(/\/$/, '')}/data/${encodeURIComponent(ts.id)}.json`;
    try {
      const res = await fetch(`${tilejsonUrl}?v=${encodeURIComponent(rev)}`, { cache: 'no-store' });
      if (!fresh()) return;
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
      if (!fresh()) return;
      const attribution = tj.attribution?.trim() || undefined;
      const isVector = Boolean(tj.vector_layers) || tj.format === 'pbf';
      if (isVector) {
        map.addSource(id, {
          type: 'vector',
          url: `${tilejsonUrl}?v=${encodeURIComponent(rev)}`,
          ...(attribution ? { attribution } : {}),
        });
        // Poseidon charts are published as bathymetry so they stay overlays.
        // Paint the bundle style above the base chart, with Poseidon's land
        // opacity. A tileset with no style adds nothing.
        await paintPoseidonChart(map, ts.id, id, before ?? 'track-line', 1, imagery, fresh);
        if (!fresh()) return;
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
      if (!fresh()) return;
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
