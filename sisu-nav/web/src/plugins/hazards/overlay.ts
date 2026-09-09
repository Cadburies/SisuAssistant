import { Popup, type GeoJSONSource, type Map as MapLibreMap, type MapMouseEvent } from 'maplibre-gl';
import type { HazardsResponse } from './types';

const CABLE_SRC = 'hazards-cables-src';
const CABLE_LAYER = 'hazards-cables-lines';
const LANDING_SRC = 'hazards-landing-src';
const LANDING_LAYER = 'hazards-landing-points';
// Fallback for the rare cable feature with no color in TeleGeography's data.
const CABLE_FALLBACK = '#39d5ff';
const LANDING_COLOR = '#8fffd2';
const LANDING_TBD_COLOR = '#6b7d8f';

function ensureLayers(map: MapLibreMap): void {
  if (!map.getSource(CABLE_SRC)) {
    map.addSource(CABLE_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: CABLE_LAYER,
      type: 'line',
      source: CABLE_SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'color'], CABLE_FALLBACK],
        'line-width': 1.6,
        'line-opacity': 0.8,
      },
    });
  }
  if (!map.getSource(LANDING_SRC)) {
    map.addSource(LANDING_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: LANDING_LAYER,
      type: 'circle',
      source: LANDING_SRC,
      paint: {
        'circle-radius': 4,
        'circle-color': ['case', ['get', 'is_tbd'], LANDING_TBD_COLOR, LANDING_COLOR],
        'circle-opacity': 0.9,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#0a1016',
      },
    });
  }
}

export function paintHazards(map: MapLibreMap, data: HazardsResponse): void {
  ensureLayers(map);
  (map.getSource(CABLE_SRC) as GeoJSONSource).setData(data.cables);
  (map.getSource(LANDING_SRC) as GeoJSONSource).setData(data.landingPoints);
}

export function clearHazards(map: MapLibreMap): void {
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  (map.getSource(CABLE_SRC) as GeoJSONSource | undefined)?.setData(empty);
  (map.getSource(LANDING_SRC) as GeoJSONSource | undefined)?.setData(empty);
}

export function bindHazardsClick(map: MapLibreMap): () => void {
  const cableClick = (e: MapMouseEvent) => {
    const hits = map.queryRenderedFeatures(e.point, { layers: [CABLE_LAYER] });
    const f = hits[0];
    if (!f) return;
    const p = f.properties || {};
    new Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${p.name || 'Submarine cable'}</strong><br/><span style="opacity:.7">${p.id || ''}</span>`)
      .addTo(map);
  };
  const landingClick = (e: MapMouseEvent) => {
    const hits = map.queryRenderedFeatures(e.point, { layers: [LANDING_LAYER] });
    const f = hits[0];
    if (!f || f.geometry.type !== 'Point') return;
    const p = f.properties || {};
    new Popup()
      .setLngLat(f.geometry.coordinates as [number, number])
      .setHTML(
        `<strong>${p.name || 'Cable landing point'}</strong>${p.is_tbd ? '<br/><span style="opacity:.7">planned — not yet laid</span>' : ''}`,
      )
      .addTo(map);
  };
  const enter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('click', CABLE_LAYER, cableClick);
  map.on('click', LANDING_LAYER, landingClick);
  map.on('mouseenter', CABLE_LAYER, enter);
  map.on('mouseleave', CABLE_LAYER, leave);
  map.on('mouseenter', LANDING_LAYER, enter);
  map.on('mouseleave', LANDING_LAYER, leave);
  return () => {
    map.off('click', CABLE_LAYER, cableClick);
    map.off('click', LANDING_LAYER, landingClick);
    map.off('mouseenter', CABLE_LAYER, enter);
    map.off('mouseleave', CABLE_LAYER, leave);
    map.off('mouseenter', LANDING_LAYER, enter);
    map.off('mouseleave', LANDING_LAYER, leave);
  };
}
