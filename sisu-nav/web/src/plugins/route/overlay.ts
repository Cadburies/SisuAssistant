import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

const SRC = 'sisu-route';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function paintRoute(map: MapLibreMap, corridor: GeoJSON.FeatureCollection | null): void {
  const src = map.getSource(SRC) as GeoJSONSource | undefined;
  if (!src) {
    map.addSource(SRC, { type: 'geojson', data: corridor || EMPTY });
    map.addLayer({
      id: `${SRC}-iso`,
      type: 'line',
      source: SRC,
      filter: ['==', ['get', 'kind'], 'isochrone'],
      paint: { 'line-color': '#7ae0a3', 'line-width': 1.2, 'line-opacity': 0.45, 'line-dasharray': [2, 1] },
    });
    map.addLayer({
      id: `${SRC}-line`,
      type: 'line',
      source: SRC,
      filter: ['==', ['get', 'kind'], 'route'],
      paint: { 'line-color': '#e0b43a', 'line-width': 3, 'line-opacity': 0.95 },
    });
    map.addLayer({
      id: `${SRC}-dest`,
      type: 'circle',
      source: SRC,
      filter: ['==', ['get', 'kind'], 'dest'],
      paint: {
        'circle-radius': 6,
        'circle-color': '#e0b43a',
        'circle-stroke-color': '#fff8e0',
        'circle-stroke-width': 2,
      },
    });
    return;
  }
  src.setData(corridor || EMPTY);
}

export function clearRoute(map: MapLibreMap): void {
  const src = map.getSource(SRC) as GeoJSONSource | undefined;
  if (src) src.setData(EMPTY);
}
