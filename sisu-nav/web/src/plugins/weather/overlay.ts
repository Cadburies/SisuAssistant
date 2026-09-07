import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import type { Forecast, ModelInfo, WindSample } from './types';

const HEAT = 'wx-heat';
const BARBS = 'wx-barbs';
const AGREE = 'wx-agree';
const CRUISE_ZOOM = 8;

export type CellPick = {
  lat: number;
  lon: number;
  samples: Record<string, WindSample | null>;
};

function circMeanDeg(degs: number[]): number | undefined {
  if (!degs.length) return undefined;
  const s = degs.reduce((a, d) => a + Math.sin((d * Math.PI) / 180), 0);
  const c = degs.reduce((a, d) => a + Math.cos((d * Math.PI) / 180), 0);
  const deg = (Math.atan2(s / degs.length, c / degs.length) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function agreement(samples: Array<WindSample | null>): {
  spread: number;
  meanTwd?: number;
  meanTws?: number;
} {
  const ok = samples.filter((s): s is WindSample => !!s);
  if (ok.length < 2) {
    return { spread: 0, meanTwd: ok[0]?.twd, meanTws: ok[0]?.tws };
  }
  const u = ok.map((s) => -s.tws * Math.sin((s.twd * Math.PI) / 180));
  const v = ok.map((s) => -s.tws * Math.cos((s.twd * Math.PI) / 180));
  const mu = u.reduce((a, b) => a + b, 0) / ok.length;
  const mv = v.reduce((a, b) => a + b, 0) / ok.length;
  const meanTws = Math.hypot(mu, mv);
  const avg = ok.reduce((a, s) => a + s.tws, 0) / ok.length;
  const vec = avg > 0.2 ? 1 - Math.min(1, meanTws / avg) : 0;
  const dirs = ok.map((s) => s.twd);
  const s = dirs.reduce((a, d) => a + Math.sin((d * Math.PI) / 180), 0) / dirs.length;
  const c = dirs.reduce((a, d) => a + Math.cos((d * Math.PI) / 180), 0) / dirs.length;
  const r = Math.min(1, Math.hypot(s, c));
  const dirStd = Math.sqrt(Math.max(0, -2 * Math.log(Math.max(r, 1e-9)))) * (180 / Math.PI);
  const dirScore = Math.min(1, dirStd / 45);
  const meanSpd = avg;
  const spdVar =
    ok.reduce((a, x) => a + (x.tws - meanSpd) ** 2, 0) / ok.length;
  const spdScore = Math.min(1, Math.sqrt(spdVar) / Math.max(meanSpd, 1) / 0.4);
  return {
    spread: 0.55 * dirScore + 0.45 * spdScore + 0.15 * vec,
    meanTwd: circMeanDeg(dirs),
    meanTws: meanTws,
  };
}

export function spreadColor(spread: number): string {
  const t = Math.min(1, Math.max(0, spread));
  const stops: Array<{ at: number; rgb: [number, number, number] }> = [
    { at: 0, rgb: [62, 207, 142] },
    { at: 0.35, rgb: [224, 180, 58] },
    { at: 0.75, rgb: [226, 74, 74] },
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

function barbImage(color: string, kn: number): ImageData {
  const w = 64;
  const h = 96;
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
  g.moveTo(0, 38);
  g.lineTo(0, -38);
  g.stroke();
  let remaining = Math.round(kn / 5) * 5;
  let y = -38;
  while (remaining >= 50) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(18, y + 8);
    g.lineTo(0, y + 12);
    g.closePath();
    g.fill();
    remaining -= 50;
    y += 12;
  }
  while (remaining >= 10) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(16, y - 8);
    g.stroke();
    remaining -= 10;
    y += 8;
  }
  if (remaining >= 5) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(9, y - 5);
    g.stroke();
  }
  return g.getImageData(0, 0, w, h);
}

function ensureImages(map: MapLibreMap, models: ModelInfo[]): void {
  for (const m of models) {
    const id = `wx-barb-${m.id}`;
    if (!map.hasImage(id)) map.addImage(id, barbImage(m.color, 15));
  }
  if (!map.hasImage('wx-barb-agree')) map.addImage('wx-barb-agree', barbImage('#e7eef6', 15));
}

function ensureLayers(map: MapLibreMap): void {
  if (!map.getSource(HEAT)) {
    map.addSource(HEAT, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource(BARBS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource(AGREE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const before = map.getLayer('track-line') ? 'track-line' : undefined;
    map.addLayer(
      {
        id: HEAT,
        type: 'fill',
        source: HEAT,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.38 },
      },
      before,
    );
    map.addLayer({
      id: BARBS,
      type: 'symbol',
      source: BARBS,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': 0.45,
        'icon-rotate': ['get', 'twd'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
    map.addLayer({
      id: AGREE,
      type: 'symbol',
      source: AGREE,
      layout: {
        'icon-image': 'wx-barb-agree',
        'icon-size': 0.5,
        'icon-rotate': ['get', 'twd'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
      },
    });
  }
}

export type PaintVis = { showWind: boolean; showDiscrepancy: boolean };

export function paintForecast(
  map: MapLibreMap,
  forecast: Forecast,
  selected: string[],
  timeIndex: number,
  vis: PaintVis = { showWind: true, showDiscrepancy: true },
): void {
  ensureImages(map, forecast.models);
  ensureLayers(map);
  const zoom = map.getZoom();
  const cruise = zoom >= CRUISE_ZOOM;
  const half = forecast.step / 2;
  const heatFeatures: GeoJSON.Feature[] = [];
  const barbFeatures: GeoJSON.Feature[] = [];
  const agreeFeatures: GeoJSON.Feature[] = [];
  const nSel = selected.length;
  const any = vis.showWind || vis.showDiscrepancy;

  for (const cell of forecast.cells) {
    const samples = selected.map((id) => cell.values[id]?.[timeIndex] ?? null);
    const ag = agreement(samples);
    if (vis.showDiscrepancy) {
      heatFeatures.push({
        type: 'Feature',
        properties: { color: spreadColor(ag.spread), lat: cell.lat, lon: cell.lon, spread: ag.spread },
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
    }
    if (!vis.showWind || !any) continue;
    if (cruise) {
      selected.forEach((id, i) => {
        const s = cell.values[id]?.[timeIndex];
        if (!s) return;
        const dx = nSel > 1 ? forecast.step * 0.18 * (i - (nSel - 1) / 2) : 0;
        barbFeatures.push({
          type: 'Feature',
          properties: { icon: `wx-barb-${id}`, twd: s.twd, model: id },
          geometry: { type: 'Point', coordinates: [cell.lon + dx, cell.lat] },
        });
      });
    } else if (ag.meanTwd != null) {
      agreeFeatures.push({
        type: 'Feature',
        properties: { twd: ag.meanTwd },
        geometry: { type: 'Point', coordinates: [cell.lon, cell.lat] },
      });
    }
  }

  (map.getSource(HEAT) as GeoJSONSource).setData({ type: 'FeatureCollection', features: heatFeatures });
  (map.getSource(BARBS) as GeoJSONSource).setData({ type: 'FeatureCollection', features: barbFeatures });
  (map.getSource(AGREE) as GeoJSONSource).setData({ type: 'FeatureCollection', features: agreeFeatures });
}

export function clearForecast(map: MapLibreMap): void {
  for (const id of [HEAT, BARBS, AGREE]) {
    const src = map.getSource(id) as GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: [] });
  }
}

export function bindHeatClick(
  map: MapLibreMap,
  onPick: (pick: CellPick | null) => void,
  getForecast: () => { forecast: Forecast | null; selected: string[]; timeIndex: number },
): () => void {
  const click = (e: MapMouseEvent) => {
    const hits = map.queryRenderedFeatures(e.point, { layers: [HEAT] });
    const f = hits[0];
    const { forecast, selected, timeIndex } = getForecast();
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
    const samples: Record<string, WindSample | null> = {};
    for (const id of selected) samples[id] = cell.values[id]?.[timeIndex] ?? null;
    onPick({ lat, lon, samples });
  };
  const enter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('click', HEAT, click);
  map.on('mouseenter', HEAT, enter);
  map.on('mouseleave', HEAT, leave);
  return () => {
    map.off('click', HEAT, click);
    map.off('mouseenter', HEAT, enter);
    map.off('mouseleave', HEAT, leave);
  };
}
