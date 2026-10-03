import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import type { RoseBin, RoseCell } from './types';

const SRC = 'sisu-roses';
const LAYER = 'sisu-roses-sym';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const SIZE = 96;
const SCALE_PCT = 40; // 40% frequency fills the outer ring

function wedge(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  a0: number,
  a1: number,
  r0: number,
  r1: number,
  color: string,
): void {
  g.beginPath();
  g.arc(cx, cy, r1, a0, a1, false);
  g.arc(cx, cy, r0, a1, a0, true);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

export function roseImage(cell: RoseCell, bins: RoseBin[]): ImageData {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d')!;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rMax = SIZE / 2 - 3;
  const rCalm = 10;
  g.clearRect(0, 0, SIZE, SIZE);
  g.beginPath();
  g.arc(cx, cy, rMax, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(231,238,246,0.25)';
  g.lineWidth = 1;
  g.stroke();
  for (const petal of cell.petals) {
    if (petal.total <= 0) continue;
    const half = (5 * Math.PI) / 180;
    const mid = ((petal.deg - 90) * Math.PI) / 180;
    const a0 = mid - half;
    const a1 = mid + half;
    const len = Math.min(1, petal.total / SCALE_PCT) * (rMax - rCalm);
    let r0 = rCalm;
    for (const b of bins) {
      const pct = petal.bands[b.id] || 0;
      if (pct <= 0) continue;
      const dr = (pct / petal.total) * len;
      wedge(g, cx, cy, a0, a1, r0, r0 + dr, b.color);
      r0 += dr;
    }
  }
  g.beginPath();
  g.arc(cx, cy, rCalm - 1, 0, Math.PI * 2);
  g.fillStyle = '#0b1016';
  g.fill();
  g.strokeStyle = 'rgba(231,238,246,0.45)';
  g.stroke();
  g.fillStyle = '#e7eef6';
  g.font = '9px ui-sans-serif, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`${cell.calmPct.toFixed(0)}%`, cx, cy);
  return g.getImageData(0, 0, SIZE, SIZE);
}

function imgId(gh: string): string {
  return `rose-${gh}`;
}

function ensure(map: MapLibreMap): void {
  if (map.getSource(SRC)) return;
  map.addSource(SRC, { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: LAYER,
    type: 'symbol',
    source: SRC,
    layout: {
      'icon-image': ['get', 'icon'],
      // Anchor spots (#187) sit ~100 m apart in one bay: small when zoomed
      // out, full size once the anchorage fills the screen. Cells stay 1.
      'icon-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        9,
        ['case', ['get', 'anchor'], 0.22, 1],
        13,
        ['case', ['get', 'anchor'], 0.45, 1],
        16,
        1,
      ],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}

export function paintRoses(
  map: MapLibreMap,
  cells: RoseCell[],
  bins: RoseBin[],
  anchor = false,
): void {
  ensure(map);
  const features: GeoJSON.Feature[] = [];
  for (const cell of cells) {
    const id = imgId(cell.geohash);
    if (map.hasImage(id)) {
      try {
        map.removeImage(id);
      } catch {
        /* ignore */
      }
    }
    map.addImage(id, roseImage(cell, bins));
    features.push({
      type: 'Feature',
      properties: { icon: id, geohash: cell.geohash, anchor },
      geometry: { type: 'Point', coordinates: [cell.lon, cell.lat] },
    });
  }
  (map.getSource(SRC) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
}

export function clearRoses(map: MapLibreMap): void {
  const src = map.getSource(SRC) as GeoJSONSource | undefined;
  src?.setData(EMPTY);
}

export function bindRoseClick(
  map: MapLibreMap,
  onPick: (geohash: string | null) => void,
): () => void {
  ensure(map);
  const click = (e: MapMouseEvent) => {
    if (!map.getLayer(LAYER)) {
      onPick(null);
      return;
    }
    const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER] });
    const gh = hits[0]?.properties?.geohash;
    onPick(typeof gh === 'string' ? gh : null);
  };
  map.on('click', LAYER, click);
  const enter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const leave = () => {
    map.getCanvas().style.cursor = '';
  };
  map.on('mouseenter', LAYER, enter);
  map.on('mouseleave', LAYER, leave);
  return () => {
    map.off('click', LAYER, click);
    map.off('mouseenter', LAYER, enter);
    map.off('mouseleave', LAYER, leave);
  };
}
