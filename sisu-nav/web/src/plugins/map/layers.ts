/**
 * Overlay catalog + visibility. Plugins register here (#85+); the Layers
 * button reads it. Do not edit App.tsx.
 */
import { getActivePoseidonProfile, profileDetailAt, type PoseidonDetailBand } from './poseidonZoomProfile.ts';

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
  | 'currents'
  | 'roses'
  | 'bathy-relief'
  | 'bathy-hillshade'
  | 'bathy-contours'
  | 'hazards-cables'
  | 'openseamap'
  | 'chart-coverage'
  | 'chart-land'
  | 'chart-land-fill'
  | 'chart-depth'
  | 'chart-hazards'
  | 'chart-areas'
  | 'chart-cables'
  | 'chart-routes'
  | 'chart-symbols'
  | 'chart-labels'
  | 'chart-poi'
  | 'chart-spans'
  | 'pois'
  | 'aircraft'
  | 'satellites';

export type LayerGroup = 'seafloor' | 'nautical' | 'weather' | 'traffic' | 'safety' | 'places' | 'reference';

export const LAYER_GROUPS: Array<{ id: LayerGroup; title: string }> = [
  { id: 'seafloor', title: 'Sea floor' },
  { id: 'nautical', title: 'Nautical chart' },
  { id: 'weather', title: 'Weather' },
  { id: 'traffic', title: 'Traffic' },
  { id: 'safety', title: 'Safety' },
  { id: 'places', title: 'Places' },
  { id: 'reference', title: 'Reference' },
];

export type LayerDef = {
  id: LayerId;
  label: string;
  group: LayerGroup;
  /** false = stub, listed but greyed. */
  ready: boolean;
  /** One-of group; turning a member on turns its siblings off. */
  mutex?: string;
  /** Optional display gate for a future zoom-aware UI. */
  minzoom?: number;
  /** This layer is part of the chart base rather than a data overlay. */
  base?: boolean;
  defaultOn?: boolean;
};

export const CATALOG: LayerDef[] = [
  { id: 'ais', label: 'AIS', group: 'traffic', ready: true, defaultOn: true, minzoom: 11 },
  // #115 — internet-sourced (AISStream.io), never merged with local `ais`
  // above; off by default, it's a passage-planning aid not a collision-
  // avoidance source.
  { id: 'ais-global', label: 'AIS (global, internet)', group: 'traffic', ready: false, defaultOn: false },
  { id: 'wx-wind', label: 'Weather wind', group: 'weather', ready: true, defaultOn: true },
  { id: 'wx-discrepancy', label: 'Wind discrepancies', group: 'weather', ready: true, defaultOn: true },
  { id: 'wx-particles', label: 'Weather particles', group: 'weather', ready: true, mutex: 'particles', defaultOn: false },
  { id: 'ens-ecmwf', label: 'Ensemble wind (ECMWF IFS)', group: 'weather', ready: false, mutex: 'ensembles' },
  { id: 'ens-aifs', label: 'AI ensemble (AIFS)', group: 'weather', ready: false, mutex: 'ensembles' },
  { id: 'ens-gefs', label: 'Backup ensemble (GEFS)', group: 'weather', ready: false, mutex: 'ensembles' },
  { id: 'rain', label: 'Rain', group: 'weather', ready: false },
  { id: 'radar', label: 'Radar', group: 'weather', ready: false },
  { id: 'clouds', label: 'Clouds', group: 'weather', ready: false },
  { id: 'dust', label: 'Dust particles', group: 'weather', ready: false, mutex: 'particles' },
  // #94 — Open-Meteo Marine Hs overlay. Combines with wind layers (no mutex).
  { id: 'waves', label: 'Waves / swell', group: 'weather', ready: false, defaultOn: false },
  // #95 — Open-Meteo Marine SMOC currents. Arrows (not the wind particle
  // field), so they combine with wx-particles / dust; no mutex.
  { id: 'currents', label: 'Currents', group: 'weather', ready: false, defaultOn: false },
  { id: 'roses', label: 'Wind roses', group: 'weather', ready: false },
  // #97 floor for #98/#99/#100 bathymetry providers — stubs until one flips
  // ready via registerLayer(). Source selection is the sea-floor one-of; the
  // display modes can combine.
  { id: 'bathy-relief', label: 'Bathymetry relief', group: 'seafloor', ready: false, minzoom: 6 },
  { id: 'bathy-hillshade', label: 'Bathymetry hillshade', group: 'seafloor', ready: false, minzoom: 6 },
  { id: 'bathy-contours', label: 'Depth contours', group: 'seafloor', ready: false, minzoom: 7 },
  // #118 — anchoring hazard, off by default so it doesn't visually compete
  // with the chart until someone's actually thinking about dropping anchor.
  { id: 'hazards-cables', label: 'Submarine cables', group: 'safety', ready: false, defaultOn: false },
  // #125 — OpenSeaMap seamarks (buoys/lights/day-marks). Marks-only PNG
  // overlay, not a basemap. Off until someone wants aids to navigation on
  // top of the Charts choice.
  { id: 'openseamap', label: 'OpenSeaMap marks', group: 'safety', ready: false, defaultOn: false },
  // Footprints of the saved mbtiles for the chart on screen. Off until
  // someone wants to see where each downloaded or harvested file reaches.
  { id: 'chart-coverage', label: 'Saved chart coverage', group: 'reference', ready: false, defaultOn: false },
  // Poseidon chart groups, from style metadata poseidon:group. The fresh
  // default is Navigation, not Full.
  { id: 'chart-land', label: 'Chart land', group: 'nautical', base: true, ready: true, defaultOn: true },
  { id: 'chart-land-fill', label: 'Chart land fill', group: 'nautical', base: true, ready: true, defaultOn: true },
  { id: 'chart-depth', label: 'Chart depth', group: 'nautical', base: true, ready: true, defaultOn: true },
  { id: 'chart-hazards', label: 'Chart hazards', group: 'nautical', base: true, ready: true, defaultOn: true },
  { id: 'chart-areas', label: 'Chart areas', group: 'nautical', base: true, ready: true, defaultOn: false },
  { id: 'chart-cables', label: 'Chart cables', group: 'nautical', base: true, ready: true, defaultOn: true },
  { id: 'chart-routes', label: 'Chart routes', group: 'nautical', base: true, ready: true, defaultOn: true },
  { id: 'chart-symbols', label: 'Chart symbols', group: 'nautical', base: true, ready: true, defaultOn: true },
  { id: 'chart-labels', label: 'Chart labels', group: 'nautical', base: true, ready: true, defaultOn: false },
  { id: 'chart-poi', label: 'Chart points of interest', group: 'nautical', base: true, ready: true, defaultOn: false },
  { id: 'chart-spans', label: 'Chart outlines', group: 'nautical', base: true, ready: true, defaultOn: false },
  { id: 'pois', label: 'Provisions / POI', group: 'places', ready: false, defaultOn: false, minzoom: 9 },
  { id: 'aircraft', label: 'Aircraft', group: 'traffic', ready: false, defaultOn: false, minzoom: 11 },
  { id: 'satellites', label: 'Satellites overhead', group: 'traffic', ready: false, defaultOn: false, minzoom: 12 },
];

const KEY = 'sisu-nav.layers';
const DETAIL_KEY = 'sisu-nav.chart.detail';
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

/** Active rows in a UI group, for the collapsed header count. */
export function groupActiveCount(group: LayerGroup): number {
  let n = 0;
  for (const id of enabled) {
    if (byId.get(id)?.group === group) n += 1;
  }
  return n;
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
  if (!def.ready) return 'not yet';
  return undefined;
}

export function setLayerOn(id: LayerId, on: boolean): boolean {
  const def = byId.get(id);
  if (!def) return false;
  if (on) {
    if (!def.ready) return false;
    // One-of groups are a single action: turning a sibling on turns the
    // previous member off. No "off X first" dead end.
    if (def.mutex) {
      for (const other of [...enabled]) {
        if (other !== id && byId.get(other)?.mutex === def.mutex) enabled.delete(other);
      }
    }
    enabled.add(id);
  } else {
    enabled.delete(id);
  }
  if (CHART_LAYER_IDS.includes(id)) markDetailManual();
  persist();
  emit();
  return true;
}

export function toggleLayer(id: LayerId): boolean {
  return setLayerOn(id, !enabled.has(id));
}

/** Poseidon chart groups, in the Chart options order. */
export const CHART_LAYER_IDS: LayerId[] = [
  'chart-land',
  'chart-land-fill',
  'chart-depth',
  'chart-hazards',
  'chart-areas',
  'chart-cables',
  'chart-routes',
  'chart-symbols',
  'chart-labels',
  'chart-poi',
  'chart-spans',
];

/** Same detail presets as Poseidon. Standard matches Full there, so it is not listed again. */
export const CHART_DETAIL_PRESETS = [
  {
    id: 'full',
    label: 'Full',
    on: CHART_LAYER_IDS,
  },
  {
    id: 'navigation',
    label: 'Navigation',
    on: ['chart-land', 'chart-land-fill', 'chart-depth', 'chart-hazards', 'chart-cables', 'chart-routes', 'chart-symbols'],
  },
  {
    id: 'contours',
    label: 'Contours only',
    on: ['chart-depth'],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    on: ['chart-land', 'chart-land-fill', 'chart-depth'],
  },
] as const;

export type ChartDetailPreset = (typeof CHART_DETAIL_PRESETS)[number]['id'];

export type ChartDetailBand = PoseidonDetailBand;

export const DETAIL_BANDS: Array<{
  id: ChartDetailBand;
  label: string;
  minzoom: number;
  maxzoom: number;
  preset: ChartDetailPreset;
}> = [
  { id: 'overview', label: 'Overview', minzoom: 0, maxzoom: 7, preset: 'minimal' },
  { id: 'coastal', label: 'Coastal', minzoom: 8, maxzoom: 11, preset: 'navigation' },
  { id: 'approach', label: 'Approach', minzoom: 12, maxzoom: 14, preset: 'navigation' },
  { id: 'harbor', label: 'Harbor', minzoom: 15, maxzoom: 24, preset: 'full' },
];

/** Detail mode is manual on a fresh browser (Navigation), not Auto. */
export function chartDetailMode(): 'auto' | 'manual' {
  try {
    const raw = localStorage.getItem(DETAIL_KEY);
    if (!raw) return 'manual';
    const parsed = JSON.parse(raw) as { mode?: unknown };
    return parsed.mode === 'auto' ? 'auto' : 'manual';
  } catch {
    return 'manual';
  }
}

function saveDetailMode(mode: 'auto' | 'manual'): void {
  try {
    localStorage.setItem(DETAIL_KEY, JSON.stringify({ mode }));
  } catch {
    /* ignore quota */
  }
}

function markDetailManual(): void {
  saveDetailMode('manual');
}

/** Profile detail wins when valid; otherwise the default band table applies. */
export function chartBandForZoom(zoom: number): (typeof DETAIL_BANDS)[number] {
  const profileBand = profileDetailAt(getActivePoseidonProfile(), zoom);
  if (profileBand) {
    const row = DETAIL_BANDS.find((band) => band.id === profileBand);
    if (row) return row;
  }
  const z = Math.max(0, Math.floor(zoom));
  return DETAIL_BANDS.find((band) => z >= band.minzoom && z <= band.maxzoom) ?? DETAIL_BANDS[0];
}

function applyPresetRow(row: (typeof CHART_DETAIL_PRESETS)[number]): void {
  const on = new Set<string>(row.on);
  let changed = false;
  for (const id of CHART_LAYER_IDS) {
    if (on.has(id)) {
      if (!enabled.has(id)) {
        enabled.add(id);
        changed = true;
      }
    } else if (enabled.has(id)) {
      enabled.delete(id);
      changed = true;
    }
  }
  if (!changed) return;
  persist();
  emit();
}

/** Select Auto: the next and current zoom choose the band preset. */
export function setChartAuto(zoom: number): void {
  saveDetailMode('auto');
  const band = chartBandForZoom(zoom);
  const row = CHART_DETAIL_PRESETS.find((item) => item.id === band.preset);
  if (row) applyPresetRow(row);
  emit();
}

/** Called on map zoom changes; a no-op in manual mode. */
export function syncChartDetail(zoom: number): void {
  if (chartDetailMode() !== 'auto') return;
  const band = chartBandForZoom(zoom);
  const row = CHART_DETAIL_PRESETS.find((item) => item.id === band.preset);
  if (row) applyPresetRow(row);
}

export function chartDetailBandLabel(zoom: number): string {
  return chartBandForZoom(zoom).label;
}

export function layerMinZoom(id: LayerId): number {
  return byId.get(id)?.minzoom ?? 0;
}

export function chartPreset(): ChartDetailPreset | 'custom' {
  const on = CHART_LAYER_IDS.filter((id) => enabled.has(id));
  for (const preset of CHART_DETAIL_PRESETS) {
    if (preset.on.length === on.length && preset.on.every((id) => enabled.has(id))) return preset.id;
  }
  return 'custom';
}

/** Turn the Poseidon chart groups to one detail preset. Other overlays stay as they are. */
export function applyChartPreset(preset: ChartDetailPreset): void {
  const row = CHART_DETAIL_PRESETS.find((item) => item.id === preset);
  if (!row) return;
  saveDetailMode('manual');
  applyPresetRow(row);
  emit();
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
