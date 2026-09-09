import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { sampleAt, type CurrentForecast, type CurrentSample } from './types';

const SRC = 'currents-arrows';
const LAYER = 'currents-arrows';
const ICON_SLOW = 'currents-slow';
const ICON_MOD = 'currents-mod';
const ICON_FAST = 'currents-fast';
const ICON_JET = 'currents-jet';

export type CellPick = {
  lat: number;
  lon: number;
  sample: CurrentSample;
};

/** Speed (kn) → fill. Caribbean jets / Gulf Stream, not a Beaufort scale. */
export function speedColor(kn: number): string {
  const t = Math.min(4, Math.max(0, kn));
  const stops: Array<{ at: number; rgb: [number, number, number] }> = [
    { at: 0, rgb: [51, 255, 176] },
    { at: 0.5, rgb: [41, 224, 255] },
    { at: 1.5, rgb: [255, 201, 77] },
    { at: 2.5, rgb: [226, 122, 58] },
    { at: 4, rgb: [226, 74, 74] },
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

function speedIcon(kn: number): string {
  if (kn < 0.5) return ICON_SLOW;
  if (kn < 1.5) return ICON_MOD;
  if (kn < 2.5) return ICON_FAST;
  return ICON_JET;
}

function arrowImage(color: string): ImageData {
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
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(0, 26);
  g.lineTo(0, -22);
  g.stroke();
  g.beginPath();
  g.moveTo(0, -26);
  g.lineTo(-8, -10);
  g.lineTo(8, -10);
  g.closePath();
  g.fill();
  return g.getImageData(0, 0, w, h);
}

function ensureImages(map: MapLibreMap): void {
  if (!map.hasImage(ICON_SLOW)) map.addImage(ICON_SLOW, arrowImage('#33ffb0'));
  if (!map.hasImage(ICON_MOD)) map.addImage(ICON_MOD, arrowImage('#29e0ff'));
  if (!map.hasImage(ICON_FAST)) map.addImage(ICON_FAST, arrowImage('#ffc94d'));
  if (!map.hasImage(ICON_JET)) map.addImage(ICON_JET, arrowImage('#e24a4a'));
}

function ensureLayers(map: MapLibreMap): void {
  if (map.getSource(SRC)) return;
  map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const before = map.getLayer('track-line') ? 'track-line' : undefined;
  map.addLayer(
    {
      id: LAYER,
      type: 'symbol',
      source: SRC,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['interpolate', ['linear'], ['get', 'kn'], 0, 0.35, 3, 0.6],
        'icon-rotate': ['get', 'dir'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
    before,
  );
}

export function paintCurrents(map: MapLibreMap, forecast: CurrentForecast, timeIndex: number): void {
  ensureImages(map);
  ensureLayers(map);
  const features: GeoJSON.Feature[] = [];
  for (const cell of forecast.cells) {
    const s = sampleAt(cell, timeIndex);
    if (s.velocityKn == null || s.dir == null) continue;
    const kn = s.velocityKn;
    features.push({
      type: 'Feature',
      properties: {
        icon: speedIcon(kn),
        dir: s.dir,
        lat: cell.lat,
        lon: cell.lon,
        kn,
      },
      geometry: { type: 'Point', coordinates: [cell.lon, cell.lat] },
    });
  }
  (map.getSource(SRC) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}

export function clearCurrents(map: MapLibreMap): void {
  const src = map.getSource(SRC) as GeoJSONSource | undefined;
  src?.setData({ type: 'FeatureCollection', features: [] });
}

export function bindCurrentsClick(
  map: MapLibreMap,
  onPick: (pick: CellPick | null) => void,
  getForecast: () => { forecast: CurrentForecast | null; timeIndex: number },
): () => void {
  const click = (e: MapMouseEvent) => {
    const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER] });
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
  map.on('click', LAYER, click);
  map.on('mouseenter', LAYER, enter);
  map.on('mouseleave', LAYER, leave);
  return () => {
    map.off('click', LAYER, click);
    map.off('mouseenter', LAYER, enter);
    map.off('mouseleave', LAYER, leave);
  };
}
