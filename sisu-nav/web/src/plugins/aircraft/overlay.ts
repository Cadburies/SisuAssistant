import { Popup, type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';

const SRC = 'aircraft-src';
const LAYER = 'aircraft-icon';
const IMG = 'aircraft-tri';

function planeImage(): ImageData {
  const w = 32;
  const h = 32;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.translate(w / 2, h / 2);
  g.fillStyle = '#cfeaf0';
  g.strokeStyle = '#070b10';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, -12);
  g.lineTo(8, 10);
  g.lineTo(0, 6);
  g.lineTo(-8, 10);
  g.closePath();
  g.fill();
  g.stroke();
  return g.getImageData(0, 0, w, h);
}

export function paintAircraft(map: MapLibreMap, fc: GeoJSON.FeatureCollection): void {
  if (!map.hasImage(IMG)) map.addImage(IMG, planeImage());
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const before = map.getLayer('track-line') ? 'track-line' : undefined;
    map.addLayer(
      {
        id: LAYER,
        type: 'symbol',
        source: SRC,
        layout: {
          'icon-image': IMG,
          'icon-size': 0.7,
          'icon-rotate': ['get', 'track'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'text-field': ['get', 'flight'],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-optional': true,
        },
        paint: { 'text-color': '#cfeaf0', 'text-halo-color': '#070b10', 'text-halo-width': 1 },
      },
      before,
    );
  }
  (map.getSource(SRC) as GeoJSONSource)?.setData(fc);
}

export function clearAircraft(map: MapLibreMap | null): void {
  if (!map) return;
  if (map.getLayer(LAYER)) map.removeLayer(LAYER);
  if (map.getSource(SRC)) map.removeSource(SRC);
}

export function bindAircraftClick(map: MapLibreMap): () => void {
  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const p = f.properties || {};
    const alt = p.alt != null ? `${p.alt} ft` : '—';
    new Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${p.flight || p.hex}</strong><br/>alt ${alt}<br/>adsb.lol`)
      .addTo(map);
  };
  map.on('click', LAYER, onClick);
  return () => map.off('click', LAYER, onClick);
}
