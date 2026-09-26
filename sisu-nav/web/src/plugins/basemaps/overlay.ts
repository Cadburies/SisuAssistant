import type { Map as MapLibreMap, RasterSourceSpecification } from 'maplibre-gl';
import type { LiveBasemapId } from '../map/basemap';

const SRC = 'basemap-live-src';
const LAYER = 'basemap-live-raster';

export type BasemapDef = {
  source: RasterSourceSpecification;
};

export type GoogleBasemapConfig = { configured: true; key: string; session: string; tileSize: number };

/**
 * Esri/OSM need no key — fixed templates. Mapbox needs its public token from
 * RuntimeConfig; Azure Maps tiles come through the server proxy
 * /api/basemaps/azure/{z}/{x}/{y} so its subscription key stays server-side (#168). Google needs a session (GET /api/basemaps/google); the tile
 * URL still carries the raw key per Google's contract. None of these persist
 * to disk — live-display counterpart to harvestable providers in #117.
 *
 * Azure Maps (not Bing): Bing Maps Basic retired 2026-06-30. Imagery is
 * Render Get Map Tile `microsoft.imagery`, XYZ, Gen2 SKU.
 */
export function basemapDef(
  id: LiveBasemapId,
  mapboxToken: string | null,
  google: GoogleBasemapConfig | null,
  azureConfigured: boolean,
): BasemapDef | null {
  switch (id) {
    case 'osm':
      return null;
    case 'esri':
      return {
        source: {
          type: 'raster',
          tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS community',
        },
      };
    case 'mapbox':
      if (!mapboxToken) return null;
      return {
        source: {
          type: 'raster',
          tiles: [`https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=${mapboxToken}`],
          tileSize: 256,
          attribution: '© Mapbox © Maxar',
        },
      };
    case 'google':
      if (!google) return null;
      return {
        source: {
          type: 'raster',
          tiles: [`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${google.session}&key=${google.key}`],
          tileSize: google.tileSize,
          attribution: '© Google',
        },
      };
    case 'azure':
      if (!azureConfigured) return null;
      return {
        source: {
          type: 'raster',
          tiles: [
            `${window.location.origin}/api/basemaps/azure/{z}/{x}/{y}`,
          ],
          tileSize: 256,
          minzoom: 1,
          maxzoom: 19,
          attribution: '© Microsoft',
        },
      };
    default:
      return null;
  }
}

function removeBasemap(map: MapLibreMap): void {
  if (map.getLayer(LAYER)) map.removeLayer(LAYER);
  if (map.getSource(SRC)) map.removeSource(SRC);
}

/** Swaps in `def`, or clears the live basemap entirely if `def` is null. */
export function setBasemap(map: MapLibreMap, def: BasemapDef | null): void {
  removeBasemap(map);
  if (!def) return;
  map.addSource(SRC, def.source);
  const before = map.getLayer('track-line') ? 'track-line' : undefined;
  map.addLayer({ id: LAYER, type: 'raster', source: SRC, paint: { 'raster-opacity': 1 } }, before);
}

/** MapLibre fires this when a live raster tile 404s/403s — otherwise the map just goes blank. */
export function bindBasemapErrors(
  map: MapLibreMap,
  onError: (msg: string | null) => void,
): () => void {
  let n = 0;
  const onErr = (e: { error?: Error; sourceId?: string }) => {
    const src = e.sourceId;
    const msg = e.error?.message || String(e.error || '');
    const ours = src === SRC || src === LAYER;
    if (!ours && src) return;
    if (!ours && !map.getSource(SRC)) return;
    n += 1;
    onError(n === 1 ? `tile failed: ${msg || 'no data'}` : `${n} live tiles failed (${msg || 'no data'})`);
  };
  map.on('error', onErr);
  return () => {
    map.off('error', onErr);
  };
}
