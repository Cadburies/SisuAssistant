/**
 * Single chart choice (#185). The Charts list writes this; MapView and the
 * live underlay read it. Layers is overlays only.
 *
 * Stored values:
 *   auto
 *   source:<id>
 *   source:<id>|<file>     one area inside a family
 * Legacy live: / harvest: / imported: values migrate on read.
 */

export type LiveBasemapId = 'osm' | 'esri' | 'mapbox' | 'google' | 'azure';

export type BasemapChoice =
  | { kind: 'auto' }
  | { kind: 'source'; id: string; file?: string };

export const LIVE_BASEMAPS: Array<{ id: LiveBasemapId; label: string; needs?: 'mapbox' | 'google' | 'azure' }> = [
  { id: 'osm', label: 'OpenStreetMap' },
  { id: 'esri', label: 'Esri imagery' },
  { id: 'mapbox', label: 'Mapbox Satellite', needs: 'mapbox' },
  { id: 'google', label: 'Google Satellite', needs: 'google' },
  { id: 'azure', label: 'Azure imagery', needs: 'azure' },
];

/** Harvest provider id → the live row it shares. */
export const HARVEST_TWIN: Record<string, LiveBasemapId> = {
  'esri-world-imagery': 'esri',
  'mapbox-satellite': 'mapbox',
  'google-satellite': 'google',
  'azure-maps-imagery': 'azure',
};

const KEY = 'sisu-nav.basemap';
const LAST_LIVE = 'sisu-nav.basemap.lastLive';
const LIVE_IDS = new Set<LiveBasemapId>(LIVE_BASEMAPS.map((l) => l.id));
type Listener = () => void;
const listeners = new Set<Listener>();
const underlayListeners = new Set<Listener>();

export function encodeBasemap(c: BasemapChoice): string {
  if (c.kind === 'auto') return 'auto';
  return c.file ? `source:${c.id}|${c.file}` : `source:${c.id}`;
}

export function parseBasemap(raw: string | null | undefined): BasemapChoice | null {
  if (!raw) return null;
  if (raw === 'auto') return { kind: 'auto' };
  const cut = raw.indexOf(':');
  if (cut < 1) return null;
  const kind = raw.slice(0, cut);
  const rest = raw.slice(cut + 1);
  if (!rest) return null;
  if (kind === 'source') {
    const bar = rest.indexOf('|');
    if (bar < 0) return { kind: 'source', id: rest };
    const id = rest.slice(0, bar);
    const file = rest.slice(bar + 1);
    if (!id || !file) return null;
    return { kind: 'source', id, file };
  }
  if (kind === 'live') {
    const liveId = (rest === 'carto' ? 'osm' : rest) as LiveBasemapId;
    if (!LIVE_IDS.has(liveId)) return null;
    return { kind: 'source', id: liveId };
  }
  if (kind === 'harvest') {
    return { kind: 'source', id: HARVEST_TWIN[rest] || rest };
  }
  if (kind === 'imported') return { kind: 'source', id: `import:${rest}` };
  return null;
}

function load(): BasemapChoice {
  try {
    return parseBasemap(localStorage.getItem(KEY)) ?? { kind: 'auto' };
  } catch {
    return { kind: 'auto' };
  }
}

let current = load();
let underlay: LiveBasemapId | null = null;

function persist(): void {
  try {
    localStorage.setItem(KEY, encodeBasemap(current));
  } catch {
    /* quota */
  }
}

function emit(): void {
  for (const fn of listeners) fn();
}

export function getBasemap(): BasemapChoice {
  return current;
}

export function setBasemapChoice(next: BasemapChoice): void {
  if (encodeBasemap(current) === encodeBasemap(next)) return;
  current = next;
  persist();
  emit();
}

/** Re-paint after a fill without changing the Charts selection. */
export function refreshBasemap(): void {
  emit();
}

export function subscribeBasemap(fn: Listener): () => void {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}

export function noteLive(id: LiveBasemapId | null): void {
  if (!id) return;
  try {
    localStorage.setItem(LAST_LIVE, id);
  } catch {
    /* quota */
  }
}

export function getLastLive(): LiveBasemapId | null {
  try {
    const raw = localStorage.getItem(LAST_LIVE);
    if (raw && LIVE_IDS.has(raw as LiveBasemapId)) return raw as LiveBasemapId;
  } catch {
    /* private mode */
  }
  return null;
}

/** Live raster drawn under saved tiles of the chart on screen. Not persisted. */
export function getUnderlay(): LiveBasemapId | null {
  return underlay;
}

export function setUnderlay(id: LiveBasemapId | null): void {
  if (underlay === id) return;
  underlay = id;
  for (const fn of underlayListeners) fn();
}

export function subscribeUnderlay(fn: Listener): () => void {
  underlayListeners.add(fn);
  fn();
  return () => underlayListeners.delete(fn);
}
