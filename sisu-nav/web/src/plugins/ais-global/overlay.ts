import { Popup, type GeoJSONSource, type Map as MapLibreMap, type MapMouseEvent } from 'maplibre-gl';
import type { GlobalVessel } from './types';

const SRC = 'ais-global';
const LAYER = 'ais-global-points';
// Distinct from local AIS's boat-icon cyan (#3ec6d8) — a different accent so
// the two tiers never look like the same data source at a glance.
const COLOR = '#c86bff';

function ensureLayer(map: MapLibreMap): void {
  if (map.getSource(SRC)) return;
  map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: LAYER,
    type: 'circle',
    source: SRC,
    paint: {
      'circle-radius': 4.5,
      'circle-color': COLOR,
      'circle-opacity': 0.85,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#f3e6ff',
    },
  });
}

export function paintAisGlobal(map: MapLibreMap, vessels: GlobalVessel[]): void {
  ensureLayer(map);
  const features: GeoJSON.Feature[] = vessels.map((v) => ({
    type: 'Feature',
    properties: {
      mmsi: v.mmsi,
      name: v.name || v.mmsi,
      sog: v.sog,
      cog: v.cog,
      heading: v.heading,
    },
    geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
  }));
  (map.getSource(SRC) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}

export function clearAisGlobal(map: MapLibreMap): void {
  const src = map.getSource(SRC) as GeoJSONSource | undefined;
  src?.setData({ type: 'FeatureCollection', features: [] });
}

export function bindAisGlobalClick(map: MapLibreMap): () => void {
  const click = (e: MapMouseEvent) => {
    if (!map.getLayer(LAYER)) return;
    const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER] });
    const f = hits[0];
    if (!f || f.geometry.type !== 'Point') return;
    const p = f.properties || {};
    const sog = typeof p.sog === 'number' ? `${p.sog.toFixed(1)} kn` : '—';
    new Popup()
      .setLngLat(f.geometry.coordinates as [number, number])
      .setHTML(
        `<strong>${p.name || 'AIS (global)'}</strong><br/>MMSI ${p.mmsi || '—'}<br/>SOG ${sog}<br/><span style="opacity:.7">internet — AISStream.io</span>`,
      )
      .addTo(map);
  };
  const enter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('click', LAYER, click);
  map.on('mouseenter', LAYER, enter);
  map.on('mouseleave', LAYER, leave);
  return () => {
    map.off('click', LAYER, click);
    map.off('mouseenter', LAYER, enter);
    map.off('mouseleave', LAYER, leave);
  };
}
