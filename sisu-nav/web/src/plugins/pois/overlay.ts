import { Popup, type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';

const SRC = 'pois-src';
const LAYER = 'pois-circles';
const COLORS: Record<string, string> = {
  marina: '#3ec6d8',
  chandlery: '#e0b43a',
  fuel: '#e07a3d',
  restaurant: '#e24a4a',
  bar: '#c084fc',
  pub: '#c084fc',
  cafe: '#f4c430',
  shop: '#7ae0a3',
  other: '#cfeaf0',
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
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#070b10',
        },
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
