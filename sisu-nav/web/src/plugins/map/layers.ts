/**
 * Overlay catalog + visibility. Plugins register here (#85+); the Layers
 * button reads it. Do not edit App.tsx.
 */

export type LayerId =
  | 'ais'
  | 'ais-global'
  | 'wx-wind'
  | 'wx-discrepancy'
  | 'wx-particles'
  | 'ens-ecmwf'
  | 'ens-aifs'
  | 'ens-gefs'
  | 'rain'
  | 'radar'
  | 'clouds'
  | 'dust'
  | 'waves'
  | 'roses'
  | 'bathy-relief'
  | 'bathy-hillshade'
  | 'bathy-contours'
  | 'hazards-cables'
  | 'esri-live'
  | 'osm-live'
  | 'mapbox-live'
  | 'google-live'
  | 'bing-live';

export type LayerDef = {
  id: LayerId;
  label: string;
  /** false = stub, listed but greyed. */
  ready: boolean;
  /** Mutex group name. One member on at a time. */
  mutex?: string;
  defaultOn?: boolean;
};

export const CATALOG: LayerDef[] = [
  { id: 'ais', label: 'AIS', ready: true, defaultOn: true },
  // #115 — internet-sourced (AISStream.io), never merged with local `ais`
  // above; off by default, it's a passage-planning aid not a collision-
  // avoidance source.
  { id: 'ais-global', label: 'AIS (global, internet)', ready: false, defaultOn: false },
  { id: 'wx-wind', label: 'Weather wind', ready: true, defaultOn: true },
  { id: 'wx-discrepancy', label: 'Wind discrepancies', ready: true, defaultOn: true },
  { id: 'wx-particles', label: 'Weather particles', ready: true, mutex: 'particles', defaultOn: false },
  { id: 'ens-ecmwf', label: 'Ensemble wind (ECMWF IFS)', ready: false, mutex: 'ensembles' },
  { id: 'ens-aifs', label: 'AI ensemble (AIFS)', ready: false, mutex: 'ensembles' },
  { id: 'ens-gefs', label: 'Backup ensemble (GEFS)', ready: false, mutex: 'ensembles' },
  { id: 'rain', label: 'Rain', ready: false },
  { id: 'radar', label: 'Radar', ready: false },
  { id: 'clouds', label: 'Clouds', ready: false },
  { id: 'dust', label: 'Dust particles', ready: false, mutex: 'particles' },
  // #94 — Open-Meteo Marine Hs overlay. Combines with wind layers (no mutex).
  { id: 'waves', label: 'Waves / swell', ready: false, defaultOn: false },
  { id: 'roses', label: 'Wind roses', ready: false },
  // #97 floor for #98/#99/#100 bathymetry providers — stubs until one flips
  // ready via registerLayer(). Only one relief source at a time; hillshade
  // and contours may combine with whichever relief layer is active.
  { id: 'bathy-relief', label: 'Bathymetry relief', ready: false, mutex: 'bathy-relief' },
  { id: 'bathy-hillshade', label: 'Bathymetry hillshade', ready: false },
  { id: 'bathy-contours', label: 'Depth contours', ready: false },
  // #118 — anchoring hazard, off by default so it doesn't visually compete
  // with the chart until someone's actually thinking about dropping anchor.
  { id: 'hazards-cables', label: 'Submarine cables', ready: false, defaultOn: false },
  // #116 — live (un-cached, never harvested) basemap toggles. Mutex: showing
  // more than one raster basemap at once is meaningless, only the last one
  // painted would be visible anyway. esri-live/osm-live need no key and
  // flip ready via registerLayer(); mapbox-live / google-live / bing-live
  // gate on RuntimeConfig (token / key presence). Google uses a session
  // token (`/api/basemaps/google`); Bing uses imagery metadata + a custom
  // quadkey protocol (`/api/basemaps/bing`).
  { id: 'esri-live', label: 'Esri World Imagery (live)', ready: false, mutex: 'basemap-live' },
  { id: 'osm-live', label: 'OpenStreetMap (live)', ready: false, mutex: 'basemap-live' },
  { id: 'mapbox-live', label: 'Mapbox Satellite (live)', ready: false, mutex: 'basemap-live' },
  { id: 'google-live', label: 'Google Satellite (live)', ready: false, mutex: 'basemap-live' },
  { id: 'bing-live', label: 'Bing Aerial (live)', ready: false, mutex: 'basemap-live' },
];

const KEY = 'sisu-nav.layers';
const byId = new Map(CATALOG.map((l) => [l.id, l]));
type Listener = () => void;
const listeners = new Set<Listener>();

function catalogIds(): LayerId[] {
  return CATALOG.map((l) => l.id);
}

function loadOn(): Set<LayerId> {
  const on = new Set<LayerId>();
  for (const l of CATALOG) {
    if (l.ready && l.defaultOn) on.add(l.id);
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return on;
    const parsed = JSON.parse(raw) as { on?: string[]; known?: string[] };
    if (!Array.isArray(parsed.on)) return on;
    const known = new Set(parsed.known ?? parsed.on);
    on.clear();
    for (const id of parsed.on) {
      const def = byId.get(id as LayerId);
      if (def?.ready) on.add(def.id);
    }
    // New catalog rows (e.g. AIS) default on even if an older `on` list omitted them.
    for (const l of CATALOG) {
      if (l.ready && l.defaultOn && !known.has(l.id)) on.add(l.id);
    }
  } catch {
    /* keep defaults */
  }
  return on;
}

let enabled = loadOn();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ on: [...enabled], known: catalogIds() }));
  } catch {
    /* ignore quota */
  }
}

function emit(): void {
  for (const fn of listeners) fn();
}

export function listLayers(): LayerDef[] {
  return CATALOG.map((l) => ({ ...l }));
}

export function isLayerOn(id: LayerId): boolean {
  return enabled.has(id);
}

export function mutexHolder(group: string): LayerId | undefined {
  for (const id of enabled) {
    if (byId.get(id)?.mutex === group) return id;
  }
  return undefined;
}

/** Why this row is greyed, or undefined if it can be toggled. */
export function layerBlockReason(id: LayerId): string | undefined {
  const def = byId.get(id);
  if (!def) return 'unknown layer';
  if (def.mutex) {
    const holder = mutexHolder(def.mutex);
    if (holder && holder !== id) {
      const other = byId.get(holder);
      return `one at a time (off ${other?.label ?? holder} first)`;
    }
  }
  if (!def.ready) return 'not yet';
  return undefined;
}

export function setLayerOn(id: LayerId, on: boolean): boolean {
  const def = byId.get(id);
  if (!def) return false;
  if (on) {
    if (layerBlockReason(id)) return false;
    enabled.add(id);
  } else {
    enabled.delete(id);
  }
  persist();
  emit();
  return true;
}

export function toggleLayer(id: LayerId): boolean {
  return setLayerOn(id, !enabled.has(id));
}

/** Later issues (#86/#87) flip `ready` without editing this catalog’s stubs. */
export function registerLayer(patch: Partial<LayerDef> & { id: LayerId }): void {
  const cur = byId.get(patch.id);
  if (!cur) return;
  Object.assign(cur, patch);
  if (!cur.ready) enabled.delete(cur.id);
  persist();
  emit();
}

export function subscribeLayers(fn: Listener): () => void {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}
