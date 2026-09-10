import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

export type SkyCell = { lat: number; lon: number; values: Array<number | null> };

function colorRamp(t: number, stops: Array<{ at: number; rgb: [number, number, number] }>): string {
  const x = Math.min(1, Math.max(0, t));
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (x >= stops[i].at && x <= stops[i + 1].at) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const u = (x - a.at) / (b.at - a.at || 1);
  const rgb = a.rgb.map((n, i) => Math.round(n + (b.rgb[i] - n) * u));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

const RAIN_STOPS = [
  { at: 0, rgb: [20, 40, 80] as [number, number, number] },
  { at: 0.2, rgb: [50, 120, 200] as [number, number, number] },
  { at: 1, rgb: [180, 80, 220] as [number, number, number] },
];
const CLOUD_STOPS = [
  { at: 0, rgb: [40, 50, 70] as [number, number, number] },
  { at: 1, rgb: [220, 230, 240] as [number, number, number] },
];
const DUST_STOPS = [
  { at: 0, rgb: [60, 50, 30] as [number, number, number] },
  { at: 1, rgb: [210, 150, 60] as [number, number, number] },
];

export function paintHeat(
  map: MapLibreMap,
  sourceId: string,
  cells: SkyCell[],
  timeIndex: number,
  kind: 'rain' | 'clouds' | 'dust',
  step: number,
): void {
  const layerId = `${sourceId}-fill`;
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const before = map.getLayer('track-line') ? 'track-line' : undefined;
    map.addLayer(
      {
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 18, 10, 42],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.45,
          'circle-blur': 0.6,
        },
      },
      before,
    );
  }
  const scale = kind === 'rain' ? 8 : kind === 'dust' ? 80 : 100;
  const stops = kind === 'rain' ? RAIN_STOPS : kind === 'dust' ? DUST_STOPS : CLOUD_STOPS;
  const features = cells
    .map((c) => {
      const v = c.values[timeIndex];
      if (v == null || v <= 0) return null;
      return {
        type: 'Feature' as const,
        properties: { color: colorRamp(Math.min(1, v / scale), stops), v },
        geometry: { type: 'Point' as const, coordinates: [c.lon, c.lat] },
      };
    })
    .filter(Boolean);
  const src = map.getSource(sourceId) as GeoJSONSource;
  src?.setData({ type: 'FeatureCollection', features: features as GeoJSON.Feature[] });
  void step;
}

export function clearHeat(map: MapLibreMap, sourceId: string): void {
  const layerId = `${sourceId}-fill`;
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

const RADAR_SRC = 'wx-radar-src';
const RADAR_LAYER = 'wx-radar-raster';

export function setRadar(map: MapLibreMap, tileUrl: string | null): void {
  if (map.getLayer(RADAR_LAYER)) map.removeLayer(RADAR_LAYER);
  if (map.getSource(RADAR_SRC)) map.removeSource(RADAR_SRC);
  if (!tileUrl || !map.isStyleLoaded()) return;
  map.addSource(RADAR_SRC, {
    type: 'raster',
    tiles: [tileUrl],
    tileSize: 256,
    attribution: 'RainViewer',
  });
  const before = map.getLayer('track-line') ? 'track-line' : undefined;
  map.addLayer(
    { id: RADAR_LAYER, type: 'raster', source: RADAR_SRC, paint: { 'raster-opacity': 0.65 } },
    before,
  );
}
