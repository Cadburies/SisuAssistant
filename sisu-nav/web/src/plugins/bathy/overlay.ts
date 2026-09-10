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

function keyOf(ts: Tileset): string {
  return `${ts.id} ${ts.file}`;
}

export function isSeascapeDem(ts: Tileset): boolean {
  return /seascape-dem/i.test(keyOf(ts));
}

export function isSeascapeVector(ts: Tileset): boolean {
  return /seascape-vector/i.test(keyOf(ts));
}

function isOceanRgb(ts: Tileset): boolean {
  return /maptiler-ocean-rgb/i.test(keyOf(ts));
}

function isOceanVec(ts: Tileset): boolean {
  return /maptiler-ocean(?!-rgb)/i.test(keyOf(ts));
}

function isDemTileset(ts: Tileset): boolean {
  return isSeascapeDem(ts) || isOceanRgb(ts);
}

function isVectorTileset(ts: Tileset): boolean {
  return isSeascapeVector(ts) || isOceanVec(ts);
}

export function bathyLayerForTileset(ts: Tileset): LayerId {
  const key = keyOf(ts);
  if (/hillshade/i.test(key) || isDemTileset(ts)) return 'bathy-hillshade';
  if (/contour/i.test(key) || isVectorTileset(ts)) return 'bathy-contours';
  return 'bathy-relief';
}

export function bathyLayerForProvider(providerId: string): LayerId {
  return bathyLayerForTileset({
    id: providerId,
    file: `bathymetry/${providerId}/x`,
    format: 'png',
    kind: 'bathymetry',
  });
}

function wantsTileset(
  ts: Tileset,
  layerOn: (id: LayerId) => boolean,
  providerId: string | undefined,
): boolean {
  if (ts.kind !== 'bathymetry') return false;
  // USB drop-ins (#108) stay opt-in via the Imported overlay, not mixed into
  // harvested BlueTopo/GEBCO/Seascape when relief is on.
  if (ts.imported || ts.file.startsWith('manual/')) return false;
  if (!providerId || ts.file.split('/')[1] !== providerId) return false;
  if (isDemTileset(ts)) return layerOn('bathy-hillshade');
  if (isVectorTileset(ts)) return layerOn('bathy-relief') || layerOn('bathy-contours');
  return layerOn(bathyLayerForTileset(ts));
}

function srcId(ts: Tileset): string {
  return `bathy-${ts.id}`;
}

const SUFFIXES = ['-raster', '-hillshade', '-depare', '-contours', '-contour-labels', '-soundings'];

function remove(map: MapLibreMap, id: string): void {
  for (const suffix of SUFFIXES) {
    const layerId = `${id}${suffix}`;
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  if (map.getSource(id)) map.removeSource(id);
}

function numMeta(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

type TileJson = {
  tiles?: string[];
  attribution?: string;
  tileSize?: number | string;
  tilesize?: number | string;
  minzoom?: number | string;
  maxzoom?: number | string;
  encoding?: string;
  vector_layers?: unknown[];
  format?: string;
};

function addDem(
  map: MapLibreMap,
  id: string,
  tj: TileJson,
  rev: string,
  encoding: 'terrarium' | 'mapbox',
  before?: string,
): void {
  const tileSize = numMeta(tj.tileSize ?? tj.tilesize, 512);
  const minzoom = Number(tj.minzoom);
  const maxzoom = Number(tj.maxzoom);
  const attribution = tj.attribution?.trim() || undefined;
  if (!tj.tiles?.length) return;
  map.addSource(id, {
    type: 'raster-dem',
    tiles: tj.tiles.map((u) => bustTileUrl(u, rev)),
    tileSize,
    encoding,
    ...(Number.isFinite(minzoom) ? { minzoom } : {}),
    ...(Number.isFinite(maxzoom) ? { maxzoom } : {}),
    ...(attribution ? { attribution } : {}),
  });
  map.addLayer(
    {
      id: `${id}-hillshade`,
      type: 'hillshade',
      source: id,
      paint: {
        'hillshade-exaggeration': 0.5,
        'hillshade-shadow-color': '#9adcfe',
        'hillshade-highlight-color': '#ffffff',
        'hillshade-illumination-direction': 315,
      },
    },
    before,
  );
}

function addVector(
  map: MapLibreMap,
  id: string,
  ts: Tileset,
  tj: TileJson,
  tilejsonUrl: string,
  rev: string,
  layerOn: (id: LayerId) => boolean,
  before?: string,
): void {
  const attribution = tj.attribution?.trim() || undefined;
  map.addSource(id, {
    type: 'vector',
    url: `${tilejsonUrl}?v=${encodeURIComponent(rev)}`,
    ...(attribution ? { attribution } : {}),
  });
  if (layerOn('bathy-relief') && isOceanVec(ts)) {
    map.addLayer(
      {
        id: `${id}-depare`,
        type: 'fill',
        source: id,
        'source-layer': 'contour',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['abs', ['get', 'depth']],
            0,
            '#e9f7ff',
            50,
            '#7fc7f8',
            200,
            '#1f86cb',
            2000,
            '#0b3d66',
          ],
          'fill-opacity': 0.45,
        },
      },
      before,
    );
  } else if (layerOn('bathy-relief')) {
    map.addLayer(
      {
        id: `${id}-depare`,
        type: 'fill',
        source: id,
        'source-layer': 'depare',
        minzoom: 6,
        filter: ['!', ['has', 'sys']],
        paint: {
          'fill-color': [
            'case',
            ['!', ['has', 'drval1']],
            '#1f86cb',
            ['<', ['get', 'drval1'], 0],
            '#58af9c',
            [
              'step',
              ['get', 'drval1'],
              '#3fa2e4',
              1.99,
              '#5db5f0',
              4.99,
              '#7fc7f8',
              9.99,
              '#a5d9fb',
              19.99,
              '#c9e9fd',
              49.99,
              '#e9f7ff',
            ],
          ],
          'fill-opacity': 0.55,
        },
      },
      before,
    );
  }
  if (layerOn('bathy-contours') && isOceanVec(ts)) {
    map.addLayer(
      {
        id: `${id}-contours`,
        type: 'line',
        source: id,
        'source-layer': 'contour_line',
        paint: {
          'line-color': '#768c97',
          'line-width': 0.8,
        },
      },
      before,
    );
    map.addLayer(
      {
        id: `${id}-contour-labels`,
        type: 'symbol',
        source: id,
        'source-layer': 'contour_line',
        minzoom: 8,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['to-string', ['abs', ['get', 'depth']]],
          'text-size': 10,
          'text-font': ['Open Sans Regular'],
        },
        paint: {
          'text-color': '#768c97',
          'text-halo-color': '#fff',
          'text-halo-width': 1,
        },
      },
      before,
    );
  } else if (layerOn('bathy-contours')) {
    map.addLayer(
      {
        id: `${id}-contours`,
        type: 'line',
        source: id,
        'source-layer': 'contours',
        minzoom: 6,
        filter: ['!=', ['get', 'sys'], 'ft'],
        paint: {
          'line-color': ['case', ['==', ['get', 'depth_abs_m'], 2], '#4C5B63', '#768c97'],
          'line-width': ['case', ['==', ['get', 'depth_abs_m'], 2], 1.5, 0.8],
        },
      },
      before,
    );
    map.addLayer(
      {
        id: `${id}-contour-labels`,
        type: 'symbol',
        source: id,
        'source-layer': 'contours',
        minzoom: 8,
        filter: ['!=', ['get', 'sys'], 'ft'],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['to-string', ['get', 'depth_abs_m']],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 13, 12],
          'text-font': ['Open Sans Regular'],
          'text-padding': 50,
        },
        paint: {
          'text-color': '#768c97',
          'text-halo-color': '#fff',
          'text-halo-width': 1,
        },
      },
      before,
    );
    map.addLayer(
      {
        id: `${id}-soundings`,
        type: 'symbol',
        source: id,
        'source-layer': 'soundings',
        minzoom: 7,
        layout: {
          'text-field': ['to-string', ['get', 'depth_m']],
          'text-font': ['Open Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 13, 12],
          'text-padding': 8,
        },
        paint: {
          'text-color': ['case', ['<=', ['get', 'depth_m'], 2], '#000', '#768c97'],
          'text-halo-color': '#fff',
          'text-halo-width': 1,
        },
      },
      before,
    );
  }
}

function addRaster(map: MapLibreMap, id: string, ts: Tileset, tj: TileJson, rev: string, before?: string): void {
  if (!tj.tiles?.length) return;
  const fallback = /bluetopo/i.test(ts.id) ? 512 : 256;
  const tileSize = numMeta(tj.tileSize ?? tj.tilesize, fallback);
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
}

export async function syncBathyOverlay(
  map: MapLibreMap | null,
  tileserver: string,
  listed: Tileset[],
  layerOn: (id: LayerId) => boolean,
  seen: Map<string, string>,
  providerId?: string,
): Promise<void> {
  if (!map?.isStyleLoaded()) return;
  const wanted = listed.filter((ts) => wantsTileset(ts, layerOn, providerId));
  const wantedIds = new Set(wanted.map((ts) => srcId(ts)));
  for (const id of [...seen.keys()]) {
    if (wantedIds.has(id)) continue;
    remove(map, id);
    seen.delete(id);
  }
  const before = map.getLayer('track-line') ? 'track-line' : undefined;
  for (const ts of wanted) {
    const id = srcId(ts);
    const rev = `${tilesetRev(ts)}|${layerOn('bathy-relief')}|${layerOn('bathy-hillshade')}|${layerOn('bathy-contours')}`;
    if (seen.get(id) === rev && map.getSource(id)) continue;
    if (map.getSource(id)) remove(map, id);
    const tilejsonUrl = `${tileserver.replace(/\/$/, '')}/data/${encodeURIComponent(ts.id)}.json`;
    try {
      const res = await fetch(`${tilejsonUrl}?v=${encodeURIComponent(tilesetRev(ts))}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const tj = (await res.json()) as TileJson;
      if (isDemTileset(ts)) addDem(map, id, tj, tilesetRev(ts), isOceanRgb(ts) ? 'mapbox' : 'terrarium', before);
      else if (isVectorTileset(ts)) addVector(map, id, ts, tj, tilejsonUrl, tilesetRev(ts), layerOn, before);
      else addRaster(map, id, ts, tj, tilesetRev(ts), before);
      if (map.getSource(id)) seen.set(id, rev);
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
