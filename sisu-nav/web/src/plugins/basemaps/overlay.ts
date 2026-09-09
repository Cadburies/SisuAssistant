import type { Map as MapLibreMap, RasterSourceSpecification } from 'maplibre-gl';
import type { LayerId } from '../map/layers';

const SRC = 'basemap-live-src';
const LAYER = 'basemap-live-raster';

export type BasemapDef = {
  source: RasterSourceSpecification;
};

/**
 * Esri/OSM need no key — fixed templates. Mapbox needs the token from
 * RuntimeConfig (client-exposed by design, see server.mjs's /api/config
 * comment). Never persisted to disk — this is the live-display-only
 * counterpart to the harvestable versions in #117.
 */
export function basemapDef(id: LayerId, mapboxToken: string | null): BasemapDef | null {
  switch (id) {
    case 'esri-live':
      return {
        source: {
          type: 'raster',
          tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS community',
        },
      };
    case 'osm-live':
      return {
        source: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      };
    case 'mapbox-live':
      if (!mapboxToken) return null;
      return {
        source: {
          type: 'raster',
          tiles: [`https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=${mapboxToken}`],
          tileSize: 256,
          attribution: '© Mapbox © Maxar',
        },
      };
    default:
      return null; // google-live / bing-live: not implemented yet (#116 follow-up)
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
