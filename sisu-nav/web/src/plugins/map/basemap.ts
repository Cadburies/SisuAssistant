/**
 * Single basemap choice (#127). Charts dropdown writes this; MapView and
 * the live-basemap sync read it. Layers is overlays only — not a second
 * place to pick Esri/OSM/imported charts.
 */

export type LiveBasemapId = 'carto' | 'osm' | 'esri' | 'mapbox' | 'google' | 'azure';

export type BasemapChoice =
  | { kind: 'live'; id: LiveBasemapId }
  | { kind: 'harvest'; providerId: string }
  | { kind: 'imported'; slug: string };

export const LIVE_BASEMAPS: Array<{ id: LiveBasemapId; label: string; needs?: 'mapbox' | 'google' | 'azure' }> = [
  { id: 'carto', label: 'Chart default' },
  { id: 'osm', label: 'OpenStreetMap (live)' },
  { id: 'esri', label: 'Esri World Imagery (live)' },
  { id: 'mapbox', label: 'Mapbox Satellite (live)', needs: 'mapbox' },
  { id: 'google', label: 'Google Satellite (live)', needs: 'google' },
  { id: 'azure', label: 'Azure Maps Imagery (live)', needs: 'azure' },
];

const KEY = 'sisu-nav.basemap';
const LIVE_IDS = new Set<LiveBasemapId>(LIVE_BASEMAPS.map((l) => l.id));
type Listener = () => void;
const listeners = new Set<Listener>();

export function encodeBasemap(c: BasemapChoice): string {
  if (c.kind === 'live') return `live:${c.id}`;
  if (c.kind === 'harvest') return `harvest:${c.providerId}`;
  return `imported:${c.slug}`;
}

export function parseBasemap(raw: string | null | undefined): BasemapChoice | null {
  if (!raw) return null;
  const cut = raw.indexOf(':');
  if (cut < 1) return null;
  const kind = raw.slice(0, cut);
  const id = raw.slice(cut + 1);
  if (!id) return null;
  if (kind === 'live' && LIVE_IDS.has(id as LiveBasemapId)) return { kind: 'live', id: id as LiveBasemapId };
  if (kind === 'harvest') return { kind: 'harvest', providerId: id };
  if (kind === 'imported') return { kind: 'imported', slug: id };
  return null;
}

function load(): BasemapChoice {
  try {
    return parseBasemap(localStorage.getItem(KEY)) ?? { kind: 'live', id: 'carto' };
  } catch {
    return { kind: 'live', id: 'carto' };
  }
}

let current = load();

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
  const a = encodeBasemap(current);
  const b = encodeBasemap(next);
  if (a === b) return;
  current = next;
  persist();
  emit();
}

export function subscribeBasemap(fn: Listener): () => void {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}

/** Harvested / imported tileset belongs to the current Charts basemap. */
export function tilesetMatchesBasemap(file: string, choice: BasemapChoice): boolean {
  if (choice.kind === 'harvest') {
    const parts = file.split('/');
    return parts[1] === choice.providerId;
  }
  if (choice.kind === 'imported') return file.startsWith(`manual/${choice.slug}/`);
  return false;
}
