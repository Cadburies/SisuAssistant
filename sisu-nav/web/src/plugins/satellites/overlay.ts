import { Popup, type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';
import { MAP_INK, TRAFFIC } from '../map/chartPalette';

const SRC = 'sats-src';
const LAYER = 'sats-circles';
const LABELS = 'sats-labels';

export function paintSats(map: MapLibreMap, fc: GeoJSON.FeatureCollection): void {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const before = map.getLayer('track-line') ? 'track-line' : undefined;
    map.addLayer(
      {
        id: LAYER,
        type: 'circle',
        source: SRC,
        paint: {
          'circle-radius': 3,
          'circle-color': TRAFFIC.satellite,
          'circle-opacity': 0.9,
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
  (map.getSource(SRC) as GeoJSONSource)?.setData(fc);
}

export function clearSats(map: MapLibreMap | null): void {
  if (!map) return;
  if (map.getLayer(LAYER)) map.removeLayer(LAYER);
  if (map.getLayer(LABELS)) map.removeLayer(LABELS);
  if (map.getSource(SRC)) map.removeSource(SRC);
}

export function bindSatsClick(map: MapLibreMap): () => void {
  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const p = f.properties || {};
    new Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${p.name || 'SAT'}</strong><br/>NORAD ${p.norad || '—'}<br/>CelesTrak`)
      .addTo(map);
  };
  map.on('click', LAYER, onClick);
  return () => map.off('click', LAYER, onClick);
}
