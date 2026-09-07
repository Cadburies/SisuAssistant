import type { Map as MapLibreMap } from 'maplibre-gl';

type Listener = (map: MapLibreMap | null) => void;

let current: MapLibreMap | null = null;
const listeners = new Set<Listener>();

/** Map instance for overlay plugins (#77+) without editing App.tsx. */
export function setNavMap(map: MapLibreMap | null): void {
  current = map;
  for (const fn of listeners) fn(current);
}

export function getNavMap(): MapLibreMap | null {
  return current;
}

export function subscribeNavMap(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}
