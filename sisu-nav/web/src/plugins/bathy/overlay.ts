import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Tileset } from '../../app/config';
import type { LayerId } from '../map/layers';

function tilesetRev(ts: Tileset): string {
  return `${ts.mtimeMs ?? 0}:${ts.bytes ?? 0}`;
}

function bustTileUrl(url: string, rev: string): string {
  const v = encodeURIComponent(rev);
  return url.includes('?') ? `${url}&v=${v}` : `${url}?v=${v}`;
}

export function bathyLayerForTileset(ts: Tileset): LayerId {
  const key = `${ts.id} ${ts.file}`;
  if (/hillshade/i.test(key)) return 'bathy-hillshade';
  if (/contour/i.test(key)) return 'bathy-contours';
  return 'bathy-relief';
}

function srcId(ts: Tileset): string {
  return `bathy-${ts.id}`;
}

function remove(map: MapLibreMap, id: string): void {
  const layerId = `${id}-raster`;
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(id)) map.removeSource(id);
}

export async function syncBathyOverlay(
  map: MapLibreMap | null,
  tileserver: string,
  listed: Tileset[],
  layerOn: (id: LayerId) => boolean,
  seen: Map<string, string>,
): Promise<void> {
  if (!map?.isStyleLoaded()) return;
  const wanted = listed.filter((ts) => ts.kind === 'bathymetry' && layerOn(bathyLayerForTileset(ts)));
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
      };
      if (!tj.tiles?.length) continue;
      const raw = tj.tileSize ?? tj.tilesize;
      const parsed = Number(raw);
      const tileSize = Number.isFinite(parsed) && parsed > 0 ? parsed : /bluetopo/i.test(ts.id) ? 512 : 256;
      const minzoom = Number(tj.minzoom);
      const maxzoom = Number(tj.maxzoom);
      const attribution = tj.attribution?.trim() || undefined;
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
          paint: { 'raster-opacity': 0.55 },
        },
        before,
      );
      seen.set(id, rev);
    } catch {
      /* tileserver has not reloaded this file yet */
    }
  }
}

export function clearBathyOverlay(map: MapLibreMap | null, seen: Map<string, string>): void {
  if (!map) return;
  for (const id of [...seen.keys()]) remove(map, id);
  seen.clear();
}
