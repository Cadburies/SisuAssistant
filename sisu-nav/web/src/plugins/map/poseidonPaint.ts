// Draw a Poseidon style.json and sprite onto an existing vector source.
// Used for a selected nautical chart and for the Poseidon depth overlays.

import type { Map as MapLibreMap, LayerSpecification } from 'maplibre-gl';
import { isLayerOn } from './layers';
import { chartLayers, chartToggleId, poseidonBasePaint } from './poseidonChart';

export function chartGroupOn(group: string): boolean {
  const id = chartToggleId(group);
  return id ? isLayerOn(id) : true;
}

interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelRatio?: number;
}

/** Register the published sprite before symbol layers ask for its images. */
export async function loadPoseidonSprite(map: MapLibreMap, base: string): Promise<void> {
  const [metaRes, pngRes] = await Promise.all([
    fetch(`${base}/sprite.json`, { cache: 'no-store' }),
    fetch(`${base}/sprite.png`, { cache: 'no-store' }),
  ]);
  if (!metaRes.ok || !pngRes.ok) return;
  const index = (await metaRes.json()) as Record<string, SpriteFrame>;
  const bitmap = await createImageBitmap(await pngRes.blob());
  try {
    for (const [name, frame] of Object.entries(index)) {
      if (!frame || frame.width <= 0 || frame.height <= 0) continue;
      const canvas = document.createElement('canvas');
      canvas.width = frame.width;
      canvas.height = frame.height;
      const g = canvas.getContext('2d');
      if (!g) continue;
      g.drawImage(bitmap, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
      if (map.hasImage(name)) map.removeImage(name);
      map.addImage(name, g.getImageData(0, 0, frame.width, frame.height), {
        pixelRatio: frame.pixelRatio || 1,
      });
    }
  } finally {
    bitmap.close();
  }
}

/**
 * The layer a basemap should be inserted before, so a Poseidon overlay
 * stays above the chart and the satellite.
 */
export function belowCharts(map: MapLibreMap, underBefore: string | null): string {
  const layers = map.getStyle()?.layers ?? [];
  const overlay = layers.find((layer) => layer.id.startsWith('imported-'))?.id ?? null;
  const candidates = [underBefore, overlay, 'track-line'];
  let best = 'track-line';
  let bestAt = Number.POSITIVE_INFINITY;
  for (const id of candidates) {
    if (!id || !map.getLayer(id)) continue;
    const at = layers.findIndex((layer) => layer.id === id);
    if (at >= 0 && at < bestAt) {
      best = id;
      bestAt = at;
    }
  }
  return best;
}

const OUTLINES: { file: string; color: string; dashed: boolean }[] = [
  { file: 'coverage.geojson', color: '#E6A817', dashed: false },
  { file: 'regions.geojson', color: '#8D6A2F', dashed: true },
];

function isCollection(value: unknown): value is GeoJSON.FeatureCollection {
  if (!value || typeof value !== 'object') return false;
  const doc = value as { type?: unknown; features?: unknown };
  return doc.type === 'FeatureCollection' && Array.isArray(doc.features);
}

/** Chart spans and region outlines, in the coverage group. */
async function paintOutlines(
  map: MapLibreMap,
  base: string,
  srcId: string,
  before: string | undefined,
  current: () => boolean,
): Promise<void> {
  for (const outline of OUTLINES) {
    if (!current()) return;
    const id = `${srcId}-${outline.file.replace('.geojson', '')}`;
    let data: unknown;
    try {
      const res = await fetch(`${base}/${outline.file}`, { cache: 'no-store' });
      if (!current()) return;
      if (!res.ok) continue;
      data = await res.json();
    } catch {
      continue;
    }
    if (!current()) return;
    if (!isCollection(data) || data.features.length === 0) continue;
    if (map.getLayer(`${id}-line`)) map.removeLayer(`${id}-line`);
    if (map.getSource(id)) map.removeSource(id);
    map.addSource(id, { type: 'geojson', data });
    map.addLayer(
      {
        id: `${id}-line`,
        type: 'line',
        source: id,
        metadata: { 'poseidon:group': 'coverage' },
        layout: { visibility: chartGroupOn('coverage') ? 'visible' : 'none' },
        paint: {
          'line-color': outline.color,
          'line-width': 1.25,
          ...(outline.dashed ? { 'line-dasharray': [2, 2] } : {}),
        },
      },
      before,
    );
  }
}

/**
 * Rebind a Poseidon style onto `srcId`. Returns the first layer id.
 * Layers are inserted before `beforeId` when that layer exists.
 * `imagery` is true when a satellite photo is already on the map.
 * `current` goes false once a newer paint starts, and this one stops.
 */
export async function paintPoseidonChart(
  map: MapLibreMap,
  tilesetId: string,
  srcId: string,
  beforeId: string,
  fillScale = 1,
  imagery = false,
  current: () => boolean = () => true,
): Promise<string | null> {
  const base = `/api/chartbundle/${encodeURIComponent(tilesetId)}`;
  let style: unknown;
  try {
    const res = await fetch(`${base}/style`, { cache: 'no-store' });
    if (!current()) return null;
    if (!res.ok) return null;
    style = await res.json();
  } catch {
    return null;
  }
  if (!current()) return null;
  await loadPoseidonSprite(map, base);
  if (!current()) return null;
  const layers = poseidonBasePaint(chartLayers(style, srcId, `${srcId}-`, chartGroupOn, fillScale), imagery);
  const before = map.getLayer(beforeId) ? beforeId : undefined;
  let first: string | null = null;
  for (const layer of layers) {
    if (!current()) return null;
    if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    map.addLayer(layer as LayerSpecification, before);
    if (!first) first = layer.id;
  }
  await paintOutlines(map, base, srcId, before, current);
  if (!current()) return null;
  return first;
}
