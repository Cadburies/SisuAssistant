// Draw a Poseidon style.json and sprite onto an existing vector source.
// Used for a selected nautical chart and for the Poseidon depth overlays.

import type { Map as MapLibreMap, LayerSpecification } from 'maplibre-gl';
import { CHART } from './chartPalette';
import { isLayerOn, syncChartDetail } from './layers';
import { chartLayers, chartToggleId, poseidonBasePaint, poseidonGroup, type ChartPaintLayer } from './poseidonChart';
import {
  loadPoseidonZoomProfile,
  poseidonMinZoom,
  setActivePoseidonProfile,
  type PoseidonZoomProfile,
} from './poseidonZoomProfile';

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

type SpriteImage = { name: string; data: ImageData; pixelRatio: number };
type CachedBundle = {
  style: unknown;
  colors: unknown;
  profile: PoseidonZoomProfile | null;
};

const bundleCache = new Map<string, CachedBundle>();
const layerCache = new Map<string, ChartPaintLayer[]>();
const spriteCache = new Map<string, SpriteImage[] | null>();
const outlineCache = new Map<string, GeoJSON.FeatureCollection | null>();

async function bundleFor(
  tilesetId: string,
  base: string,
  rev: string,
  current: () => boolean,
): Promise<CachedBundle | null> {
  const key = `${tilesetId}@${rev}`;
  const hit = bundleCache.get(key);
  if (hit) {
    setActivePoseidonProfile(tilesetId, hit.profile);
    return hit;
  }
  let style: unknown;
  let colors: unknown;
  try {
    const [styleRes, colorRes] = await Promise.all([
      fetch(`${base}/style?v=${encodeURIComponent(rev)}`, { cache: 'force-cache' }),
      fetch(`${base}/style-colors.json?v=${encodeURIComponent(rev)}`, { cache: 'force-cache' }),
    ]);
    if (!current() || !styleRes.ok) return null;
    style = await styleRes.json();
    if (colorRes.ok) colors = await colorRes.json();
    else colors = undefined;
  } catch {
    return null;
  }
  if (!current()) return null;
  const profile = await loadPoseidonZoomProfile(tilesetId, rev);
  if (!current()) return null;
  setActivePoseidonProfile(tilesetId, profile);
  const bundle = { style, colors, profile };
  bundleCache.set(key, bundle);
  return bundle;
}

/** Register the published sprite before symbol layers ask for its images. */
export async function loadPoseidonSprite(map: MapLibreMap, base: string, rev = ''): Promise<void> {
  const key = `${base}@${rev}`;
  if (spriteCache.has(key)) {
    const cached = spriteCache.get(key);
    if (!cached) return;
    for (const image of cached) {
      if (!map.hasImage(image.name)) {
        map.addImage(image.name, image.data, { pixelRatio: image.pixelRatio });
      }
    }
    return;
  }
  try {
    const [metaRes, pngRes] = await Promise.all([
      fetch(`${base}/sprite.json?v=${encodeURIComponent(rev)}`, { cache: 'force-cache' }),
      fetch(`${base}/sprite.png?v=${encodeURIComponent(rev)}`, { cache: 'force-cache' }),
    ]);
    if (!metaRes.ok || !pngRes.ok) {
      spriteCache.set(key, null);
      return;
    }
    const index = (await metaRes.json()) as Record<string, SpriteFrame>;
    const bitmap = await createImageBitmap(await pngRes.blob());
    const images: SpriteImage[] = [];
    try {
      for (const [name, frame] of Object.entries(index)) {
        if (!frame || frame.width <= 0 || frame.height <= 0) continue;
        const canvas = document.createElement('canvas');
        canvas.width = frame.width;
        canvas.height = frame.height;
        const g = canvas.getContext('2d');
        if (!g) continue;
        g.drawImage(bitmap, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
        images.push({
          name,
          data: g.getImageData(0, 0, frame.width, frame.height),
          pixelRatio: frame.pixelRatio || 1,
        });
      }
    } finally {
      bitmap.close();
    }
    spriteCache.set(key, images);
    for (const image of images) {
      if (map.hasImage(image.name)) map.removeImage(image.name);
      map.addImage(image.name, image.data, { pixelRatio: image.pixelRatio });
    }
  } catch {
    spriteCache.set(key, null);
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
  { file: 'coverage.geojson', color: CHART.coverage, dashed: false },
  { file: 'regions.geojson', color: CHART.region, dashed: true },
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
  rev: string,
): Promise<void> {
  for (const outline of OUTLINES) {
    if (!current()) return;
    const id = `${srcId}-${outline.file.replace('.geojson', '')}`;
    const key = `${base}/${outline.file}@${rev}`;
    let data: GeoJSON.FeatureCollection | null;
    if (outlineCache.has(key)) {
      data = outlineCache.get(key) ?? null;
    } else {
      try {
        const res = await fetch(`${base}/${outline.file}?v=${encodeURIComponent(rev)}`, { cache: 'force-cache' });
        if (!current()) return;
        data = res.ok ? ((await res.json()) as unknown as GeoJSON.FeatureCollection) : null;
        if (!isCollection(data)) data = null;
        outlineCache.set(key, data);
      } catch {
        outlineCache.set(key, null);
        continue;
      }
    }
    if (!current()) return;
    if (!data || data.features.length === 0) continue;
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

function visibleFor(layer: ChartPaintLayer): 'visible' | 'none' {
  const group = poseidonGroup(layer.metadata);
  if (group && !chartGroupOn(group)) return 'none';
  if (group === 'land' && layer.type === 'fill' && !isLayerOn('chart-land-fill')) return 'none';
  return 'visible';
}

function layerFloor(layerId: string, chartFloor: number): number | null {
  if (layerId.includes('contour-label')) return Math.max(chartFloor, 10);
  if (layerId.includes('soundg')) return Math.max(chartFloor, 11);
  return null;
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
  rev = '',
): Promise<string | null> {
  const base = `/api/chartbundle/${encodeURIComponent(tilesetId)}`;
  const bundle = await bundleFor(tilesetId, base, rev, current);
  if (!bundle || !current()) return null;
  syncChartDetail(map.getZoom());
  if (!current()) return null;
  await loadPoseidonSprite(map, base, rev);
  if (!current()) return null;
  const cacheKey = `${tilesetId}@${rev}|${srcId}|fill=${fillScale}|img=${imagery ? 1 : 0}`;
  let templates = layerCache.get(cacheKey);
  if (!templates) {
    templates = poseidonBasePaint(
      chartLayers(bundle.style, srcId, `${srcId}-`, chartGroupOn, fillScale, bundle.colors),
      imagery,
    );
    layerCache.set(cacheKey, templates);
  }
  const chartFloor = poseidonMinZoom(tilesetId, bundle.profile);
  const layers = templates.map((layer) => {
    const labelFloor = layerFloor(layer.id, chartFloor);
    return {
      ...layer,
      minzoom: labelFloor ?? Math.max(layer.minzoom ?? 0, chartFloor),
      layout: { ...(layer.layout ?? {}), visibility: visibleFor(layer) },
    };
  });
  const before = map.getLayer(beforeId) ? beforeId : undefined;
  let first: string | null = null;
  for (const layer of layers) {
    if (!current()) return null;
    if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    map.addLayer(layer as LayerSpecification, before);
    if (!first) first = layer.id;
  }
  await paintOutlines(map, base, srcId, before, current, rev);
  if (!current()) return null;
  return first;
}
