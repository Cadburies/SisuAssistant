import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import type { EnsembleForecast, MemberInfo, WindSample } from './types';

const LINES = 'ens-lines';
const CRUISE_ZOOM = 8;
const MAX_TWS_KN = 40;
const LINE_FRACTION = 0.42;

export type CellPick = {
  lat: number;
  lon: number;
  samples: Record<string, WindSample | null>;
};

function vectorEnd(lat: number, lon: number, sample: WindSample, lengthDeg: number): [number, number] {
  const bearing = ((sample.twd + 180) % 360) * (Math.PI / 180);
  const len = Math.min(1.4, sample.tws / MAX_TWS_KN) * lengthDeg;
  const dLat = Math.cos(bearing) * len;
  const dLon = (Math.sin(bearing) * len) / Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  return [lon + dLon, lat + dLat];
}

function ensureLayer(map: MapLibreMap): void {
  if (map.getSource(LINES)) return;
  map.addSource(LINES, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const before = map.getLayer('track-line') ? 'track-line' : undefined;
  map.addLayer(
    {
      id: LINES,
      type: 'line',
      source: LINES,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['get', 'isControl'], 2.4, 1.3],
        'line-opacity': ['case', ['get', 'isControl'], 0.95, 0.55],
      },
    },
    before,
  );
}

export function paintEnsemble(
  map: MapLibreMap,
  forecast: EnsembleForecast,
  selected: string[],
  timeIndex: number,
): void {
  ensureLayer(map);
  const zoom = map.getZoom();
  const cruise = zoom >= CRUISE_ZOOM;
  const lengthDeg = forecast.step * LINE_FRACTION;
  const byId = new Map<string, MemberInfo>(forecast.models.map((m) => [m.id, m]));
  const members = cruise ? selected : selected.filter((id) => id === 'control');
  const features: GeoJSON.Feature[] = [];

  for (const cell of forecast.cells) {
    for (const id of members) {
      const s = cell.values[id]?.[timeIndex];
      if (!s) continue;
      const end = vectorEnd(cell.lat, cell.lon, s, lengthDeg);
      features.push({
        type: 'Feature',
        properties: { color: byId.get(id)?.color ?? '#8aa0b5', isControl: id === 'control', member: id },
        geometry: { type: 'LineString', coordinates: [[cell.lon, cell.lat], end] },
      });
    }
  }

  (map.getSource(LINES) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}

export function clearEnsemble(map: MapLibreMap): void {
  const src = map.getSource(LINES) as GeoJSONSource | undefined;
  src?.setData({ type: 'FeatureCollection', features: [] });
}

export function bindEnsembleClick(
  map: MapLibreMap,
  onPick: (pick: CellPick | null) => void,
  getState: () => { forecast: EnsembleForecast | null; selected: string[]; timeIndex: number },
): () => void {
  const click = (e: MapMouseEvent) => {
    if (!map.getLayer(LINES)) {
      onPick(null);
      return;
    }
    const hits = map.queryRenderedFeatures(e.point, { layers: [LINES] });
    const { forecast, selected, timeIndex } = getState();
    const memberId = hits[0]?.properties?.member;
    if (typeof memberId !== 'string' || !forecast) {
      onPick(null);
      return;
    }
    const clickLngLat = map.unproject(e.point);
    let best = forecast.cells[0];
    let bestD = Infinity;
    for (const c of forecast.cells) {
      const d = (c.lat - clickLngLat.lat) ** 2 + (c.lon - clickLngLat.lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) {
      onPick(null);
      return;
    }
    const samples: Record<string, WindSample | null> = {};
    for (const id of selected) samples[id] = best.values[id]?.[timeIndex] ?? null;
    onPick({ lat: best.lat, lon: best.lon, samples });
  };
  const enter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('click', LINES, click);
  map.on('mouseenter', LINES, enter);
  map.on('mouseleave', LINES, leave);
  return () => {
    map.off('click', LINES, click);
    map.off('mouseenter', LINES, enter);
    map.off('mouseleave', LINES, leave);
  };
}
