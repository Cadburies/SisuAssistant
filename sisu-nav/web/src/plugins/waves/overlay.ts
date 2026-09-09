import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { sampleAt, type WaveForecast, type WaveSample } from './types';

const HS = 'waves-hs';
const TICKS = 'waves-ticks';
const ICON_COMBINED = 'waves-tick-combined';
const ICON_SWELL = 'waves-tick-swell';
const ICON_WINDSEA = 'waves-tick-windsea';

export type CellPick = {
  lat: number;
  lon: number;
  sample: WaveSample;
};

/** Hs (m) → colour. Comfort / knockdown for a cruising yacht, not Beaufort. */
export function hsColor(hs: number): string {
  const t = Math.min(6, Math.max(0, hs));
  const stops: Array<{ at: number; rgb: [number, number, number] }> = [
    { at: 0, rgb: [51, 255, 176] },
    { at: 0.75, rgb: [41, 224, 255] },
    { at: 1.5, rgb: [255, 201, 77] },
    { at: 2.5, rgb: [226, 122, 58] },
    { at: 4, rgb: [226, 74, 74] },
    { at: 6, rgb: [176, 80, 200] },
  ];
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].at && t <= stops[i + 1].at) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const u = (t - a.at) / (b.at - a.at || 1);
  const rgb = a.rgb.map((x, i) => Math.round(x + (b.rgb[i] - x) * u));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function tickImage(color: string, head: boolean): ImageData {
  const w = 48;
  const h = 72;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.translate(w / 2, h / 2);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 26);
  g.lineTo(0, -26);
  g.stroke();
  if (head) {
    g.beginPath();
    g.moveTo(0, -26);
    g.lineTo(-7, -14);
    g.moveTo(0, -26);
    g.lineTo(7, -14);
    g.stroke();
  } else {
    g.beginPath();
    g.arc(0, -26, 3, 0, Math.PI * 2);
    g.fill();
  }
  return g.getImageData(0, 0, w, h);
}

function ensureImages(map: MapLibreMap): void {
  if (!map.hasImage(ICON_COMBINED)) map.addImage(ICON_COMBINED, tickImage('#29e0ff', true));
  if (!map.hasImage(ICON_SWELL)) map.addImage(ICON_SWELL, tickImage('#29e0ff', true));
  if (!map.hasImage(ICON_WINDSEA)) map.addImage(ICON_WINDSEA, tickImage('#ffc94d', false));
}

function ensureLayers(map: MapLibreMap): void {
  if (map.getSource(HS)) return;
  map.addSource(HS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource(TICKS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const before = map.getLayer('track-line') ? 'track-line' : undefined;
  map.addLayer(
    {
      id: HS,
      type: 'fill',
      source: HS,
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.38 },
    },
    before,
  );
  map.addLayer({
    id: TICKS,
    type: 'symbol',
    source: TICKS,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': 0.5,
      'icon-rotate': ['get', 'dir'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}

export function paintWaves(map: MapLibreMap, forecast: WaveForecast, timeIndex: number): void {
  ensureImages(map);
  ensureLayers(map);
  const half = forecast.step / 2;
  const heatFeatures: GeoJSON.Feature[] = [];
  const tickFeatures: GeoJSON.Feature[] = [];
  const split = forecast.hasComponents;

  for (const cell of forecast.cells) {
    const s = sampleAt(cell, timeIndex);
    if (s.hs == null) continue;
    heatFeatures.push({
      type: 'Feature',
      properties: { color: hsColor(s.hs), lat: cell.lat, lon: cell.lon, hs: s.hs },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [cell.lon - half, cell.lat - half],
          [cell.lon + half, cell.lat - half],
          [cell.lon + half, cell.lat + half],
          [cell.lon - half, cell.lat + half],
          [cell.lon - half, cell.lat - half],
        ]],
      },
    });
    if (split) {
      if (s.swellDir != null) {
        tickFeatures.push({
          type: 'Feature',
          properties: { icon: ICON_SWELL, dir: s.swellDir },
          geometry: { type: 'Point', coordinates: [cell.lon - forecast.step * 0.12, cell.lat] },
        });
      }
      if (s.windSeaDir != null) {
        tickFeatures.push({
          type: 'Feature',
          properties: { icon: ICON_WINDSEA, dir: s.windSeaDir },
          geometry: { type: 'Point', coordinates: [cell.lon + forecast.step * 0.12, cell.lat] },
        });
      }
    } else if (s.dir != null) {
      tickFeatures.push({
        type: 'Feature',
        properties: { icon: ICON_COMBINED, dir: s.dir },
        geometry: { type: 'Point', coordinates: [cell.lon, cell.lat] },
      });
    }
  }

  (map.getSource(HS) as GeoJSONSource).setData({ type: 'FeatureCollection', features: heatFeatures });
  (map.getSource(TICKS) as GeoJSONSource).setData({ type: 'FeatureCollection', features: tickFeatures });
}

export function clearWaves(map: MapLibreMap): void {
  for (const id of [HS, TICKS]) {
    const src = map.getSource(id) as GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: [] });
  }
}

export function bindWavesClick(
  map: MapLibreMap,
  onPick: (pick: CellPick | null) => void,
  getForecast: () => { forecast: WaveForecast | null; timeIndex: number },
): () => void {
  const click = (e: MapMouseEvent) => {
    const hits = map.queryRenderedFeatures(e.point, { layers: [HS] });
    const f = hits[0];
    const { forecast, timeIndex } = getForecast();
    if (!f || !forecast) {
      onPick(null);
      return;
    }
    const lat = Number(f.properties?.lat);
    const lon = Number(f.properties?.lon);
    const cell = forecast.cells.find((c) => c.lat === lat && c.lon === lon);
    if (!cell) {
      onPick(null);
      return;
    }
    onPick({ lat, lon, sample: sampleAt(cell, timeIndex) });
  };
  const enter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('click', HS, click);
  map.on('mouseenter', HS, enter);
  map.on('mouseleave', HS, leave);
  return () => {
    map.off('click', HS, click);
    map.off('mouseenter', HS, enter);
    map.off('mouseleave', HS, leave);
  };
}
