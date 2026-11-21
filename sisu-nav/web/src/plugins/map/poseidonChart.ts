// Paint a Poseidon vector chart: rebind style.json onto a tileserver source,
// and hide groups the Layers list has switched off.

import { lineDash } from './chartPalette.ts';
import { isLayerOn } from './layers.ts';

export const CHART_GROUPS = [
  'land',
  'depth',
  'hazards',
  'areas',
  'cables',
  'routes',
  'symbols',
  'labels',
  'poi',
] as const;

export type ChartGroup = (typeof CHART_GROUPS)[number];

const DRAWABLE = new Set(['fill', 'line', 'circle', 'symbol', 'fill-extrusion']);

/** `coverage` is the chart's own outlines, not the saved-file boxes (`chart-coverage`). */
export function chartToggleId(group: string): `chart-${ChartGroup}` | 'chart-spans' | null {
  if (group === 'coverage') return 'chart-spans';
  return (CHART_GROUPS as readonly string[]).includes(group) ? (`chart-${group}` as `chart-${ChartGroup}`) : null;
}

function ownColor(metadata: unknown): boolean {
  return isObj(metadata) && metadata['poseidon:own-color'] === true;
}

function layerShown(group: string | null, type: string, groupOn: (group: string) => boolean): boolean {
  if (group != null && !groupOn(group)) return false;
  if (group === 'land' && type === 'fill' && !isLayerOn('chart-land-fill')) return false;
  return true;
}

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function poseidonGroup(metadata: unknown): string | null {
  if (!isObj(metadata)) return null;
  const group = metadata['poseidon:group'];
  return typeof group === 'string' && group !== '' ? group : null;
}

export interface ChartPaintLayer {
  id: string;
  type: string;
  source: string;
  'source-layer': string;
  metadata?: unknown;
  filter?: unknown;
  minzoom?: number;
  maxzoom?: number;
  layout?: Record<string, unknown>;
  paint?: unknown;
}

/**
 * Style layers that name a source-layer, pointed at `source`, with ids
 * prefixed so they can be removed with the source. The style's own tile
 * URL is ignored.
 */
/** Scale a fill-opacity number or expression. A missing value is fully opaque. */
export function scaleFillOpacity(value: unknown, scale: number): unknown {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * scale * 1000) / 1000;
  }
  if (Array.isArray(value)) return ['*', scale, value];
  return scale;
}

type StyleColorSpec = { color?: string; pattern?: string; width?: string };

/**
 * `style-colors.json` keys are either a layer id or `layerId:CLASS`. Apply a
 * `:CLASS` entry only to a layer whose filter actually names that class, so a
 * shared `nv-unknown` layer cannot take another class's colour.
 */
function matchStyleColor(layerId: string, filter: unknown, table: unknown): StyleColorSpec | null {
  if (!isObj(table) || !isObj(table.types)) return null;
  const types = table.types;
  const exact = types[layerId];
  if (isObj(exact)) return exact as StyleColorSpec;
  const filterText = JSON.stringify(filter ?? '');
  for (const [key, spec] of Object.entries(types)) {
    const cut = key.indexOf(':');
    if (cut < 1) continue;
    if (key.slice(0, cut) !== layerId) continue;
    const cls = key.slice(cut + 1);
    if (!cls || !filterText.includes(cls)) continue;
    if (isObj(spec)) return spec as StyleColorSpec;
  }
  return null;
}

function applyStyleColor(layer: ChartPaintLayer, spec: StyleColorSpec): void {
  if (!spec.color && !spec.pattern && !spec.width) return;
  const paint = isObj(layer.paint) ? { ...layer.paint } : {};
  if (spec.color) {
    if (layer.type === 'line') paint['line-color'] = spec.color;
    else if (layer.type === 'fill') paint['fill-color'] = spec.color;
    else if (layer.type === 'circle') paint['circle-color'] = spec.color;
    else if (layer.type === 'symbol') {
      const icon = isObj(layer.layout) && layer.layout['icon-image'] != null;
      paint[icon ? 'icon-color' : 'text-color'] = spec.color;
    }
  }
  if (layer.type === 'line') {
    if (spec.width === 'thin') paint['line-width'] = 0.9;
    const dash = lineDash(spec.pattern);
    if (dash) paint['line-dasharray'] = dash;
  }
  layer.paint = paint;
}

export function chartLayers(
  style: unknown,
  source: string,
  prefix: string,
  groupOn: (group: string) => boolean,
  fillScale = 1,
  colorTable?: unknown,
): ChartPaintLayer[] {
  if (!isObj(style) || !Array.isArray(style.layers)) return [];
  const out: ChartPaintLayer[] = [];
  for (const layer of style.layers) {
    if (!isObj(layer)) continue;
    const id = layer.id;
    const type = layer.type;
    const sourceLayer = layer['source-layer'];
    if (typeof id !== 'string' || typeof type !== 'string' || typeof sourceLayer !== 'string') continue;
    if (!DRAWABLE.has(type)) continue;
    const group = poseidonGroup(layer.metadata);
    const visible = layerShown(group, type, groupOn);
    const layout = isObj(layer.layout) ? { ...layer.layout } : {};
    layout.visibility = visible ? 'visible' : 'none';
    const next: ChartPaintLayer = {
      id: `${prefix}${id}`,
      type,
      source,
      'source-layer': sourceLayer,
      layout,
    };
    if (layer.metadata !== undefined) next.metadata = layer.metadata;
    if (layer.filter !== undefined) next.filter = layer.filter;
    if (typeof layer.minzoom === 'number') next.minzoom = layer.minzoom;
    if (typeof layer.maxzoom === 'number') next.maxzoom = layer.maxzoom;
    if (type === 'fill' && fillScale > 0 && fillScale < 1) {
      const paint = isObj(layer.paint) ? { ...layer.paint } : {};
      paint['fill-opacity'] = scaleFillOpacity(paint['fill-opacity'] === undefined ? 1 : paint['fill-opacity'], fillScale);
      next.paint = paint;
    } else if (layer.paint !== undefined) {
      next.paint = layer.paint;
    }
    if (colorTable) {
      const spec = matchStyleColor(id, layer.filter, colorTable);
      if (spec) applyStyleColor(next, spec);
    }
    // Neighbouring depth and land cells meet edge to edge. Anti-aliasing draws a seam on every cell.
    if (type === 'fill' && (sourceLayer === 'depare' || sourceLayer === 'lndare')) {
      const paint = isObj(next.paint) ? { ...next.paint } : {};
      paint['fill-antialias'] = false;
      next.paint = paint;
    }
    out.push(next);
  }
  return out;
}

export interface Coverage {
  kind: string;
  bounds?: number[] | null;
}

/** Smallest satellite archive whose bounds contain the point. */
/** Poseidon lightens land only when a satellite photo is the base. */
export function chartOverPhoto(input: {
  livePhoto: boolean;
  savedSatellite: boolean;
  satelliteUnderlay: boolean;
}): boolean {
  return input.livePhoto || input.savedSatellite || input.satelliteUnderlay;
}

export function pickSatelliteUnderlay<T extends Coverage>(tilesets: T[], lon: number, lat: number): T | null {
  let best: T | null = null;
  let bestArea = Infinity;
  for (const ts of tilesets) {
    if (ts.kind !== 'satellite' || !ts.bounds || ts.bounds.length !== 4) continue;
    const [west, south, east, north] = ts.bounds;
    if (lon < west || lon > east || lat < south || lat > north) continue;
    const area = (east - west) * (north - south);
    if (area < bestArea) {
      best = ts;
      bestArea = area;
    }
  }
  return best;
}

/**
 * Land and depth-line opacity Poseidon applies on top of the style.
 * A satellite photo keeps land light so the picture shows. OpenStreetMap
 * and a paper chart use the chart-paper fill. Depth-area colours stay as
 * published (`poseidon:own-color`).
 */
export function poseidonBasePaint<T extends { type: string; metadata?: unknown; paint?: unknown }>(
  layers: T[],
  imagery: boolean,
): T[] {
  const land = imagery ? 0.12 : 0.85;
  const depthLine = imagery ? 0.7 : 1;
  return layers.map((layer) => {
    if (ownColor(layer.metadata)) return layer;
    const group = poseidonGroup(layer.metadata);
    const paint = isObj(layer.paint) ? { ...layer.paint } : {};
    if (group === 'land' && layer.type === 'fill') {
      paint['fill-opacity'] = land;
      return { ...layer, paint };
    }
    if (group === 'depth' && layer.type === 'line') {
      paint['line-opacity'] = depthLine;
      return { ...layer, paint };
    }
    return layer;
  });
}

export function groupVisibility(
  layers: { id: string; type?: string; metadata?: unknown }[],
  groupOn: (group: string) => boolean,
): { id: string; visibility: 'visible' | 'none' }[] {
  const updates: { id: string; visibility: 'visible' | 'none' }[] = [];
  for (const layer of layers) {
    const group = poseidonGroup(layer.metadata);
    if (!group) continue;
    const visible = layerShown(group, layer.type ?? '', groupOn);
    updates.push({ id: layer.id, visibility: visible ? 'visible' : 'none' });
  }
  return updates;
}
