import { Popup, type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';
import { MAP_INK, POI } from '../map/chartPalette';

const SRC = 'pois-src';
const LAYER = 'pois-circles';
const LABELS = 'pois-labels';
const COLORS: Record<string, string> = {
  marina: POI.marina,
  chandlery: POI.chandlery,
  fuel: POI.fuel,
  restaurant: POI.restaurant,
  bar: POI.bar,
  pub: POI.pub,
  cafe: POI.cafe,
  shop: POI.shop,
  other: POI.other,
};

export function paintPois(map: MapLibreMap, fc: GeoJSON.FeatureCollection): void {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const before = map.getLayer('track-line') ? 'track-line' : undefined;
    map.addLayer(
      {
        id: LAYER,
        type: 'circle',
        source: SRC,
        minzoom: 9,
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-color': MAP_INK.pinStroke,
        },
      },
      before,
    );
    map.addLayer(
      {
        id: LABELS,
        type: 'symbol',
        source: SRC,
        minzoom: 12,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-optional': true,
          'text-font': ['Open Sans Regular'],
        },
        paint: { 'text-color': MAP_INK.label, 'text-halo-color': MAP_INK.pinStroke, 'text-halo-width': 1 },
      },
      before,
    );
  }
  const colored: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: (fc.features || []).map((f) => ({
      ...f,
      properties: {
        ...(f.properties || {}),
        color: COLORS[String(f.properties?.category || 'other')] || COLORS.other,
      },
    })),
  };
  (map.getSource(SRC) as GeoJSONSource)?.setData(colored);
}

export function clearPois(map: MapLibreMap | null): void {
  if (!map) return;
  if (map.getLayer(LAYER)) map.removeLayer(LAYER);
  if (map.getLayer(LABELS)) map.removeLayer(LABELS);
  if (map.getSource(SRC)) map.removeSource(SRC);
}

export function bindPoisClick(map: MapLibreMap): () => void {
  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const p = f.properties || {};
    new Popup().setLngLat(e.lngLat).setHTML(`<strong>${p.name || 'POI'}</strong><br/>${p.category || ''}`).addTo(map);
  };
  map.on('click', LAYER, onClick);
  return () => map.off('click', LAYER, onClick);
}
