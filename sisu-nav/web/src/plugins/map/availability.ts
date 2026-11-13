/**
 * Which chart rows belong in the current view. Pure: the picker and the map
 * both call this so the checkmark and the picture stay the same.
 */
import type { BasemapChoice, LiveBasemapId } from './basemap.ts';
import { hits, intersects, type Bbox } from './geo.ts';
import type { ChartFile, ChartSource } from './sources.ts';

export type View = { bbox: Bbox; zoom: number };

export type RankContext = {
  keys: { mapbox: boolean; google: boolean; azure: boolean };
  liveFailing: ReadonlySet<LiveBasemapId>;
  lastLiveId: LiveBasemapId | null;
};

export type RowReason = 'cover' | 'wrongZoom' | 'live' | 'needsKey' | 'failing';

export type RankedRow = {
  source: ChartSource;
  overlap: ChartFile[];
  atZoom: ChartFile[];
  badge: string;
  dim: boolean;
  reason: RowReason;
  newest: string;
};

export type GetChart = { source: ChartSource; reason: string | null };

export type RankResult = {
  auto: ChartSource | null;
  rows: RankedRow[];
  getCharts: GetChart[];
  unreadable: number;
};

export type ChartBand = 'live' | 'harvested' | 'downloaded';

const LIVE_SORT = ['osm', 'esri', 'mapbox', 'google', 'azure'];

/** Live stream, harvest cache, or an imported archive. They never share a row. */
export function chartBand(row: RankedRow): ChartBand {
  if (row.source.liveId) return 'live';
  const files = row.overlap.length ? row.overlap : row.source.files;
  if (files.length > 0 && files.every((f) => f.imported)) return 'downloaded';
  return 'harvested';
}

function zoomCovers(file: ChartFile, zoom: number): boolean {
  if (file.minZoom != null && zoom < file.minZoom) return false;
  if (file.maxZoom != null && zoom > file.maxZoom) return false;
  return true;
}

function newestOf(files: ChartFile[]): string {
  let best = '';
  for (const f of files) {
    const stamp = f.acquiredAt || f.sourceDate || '';
    if (stamp > best) best = stamp;
  }
  return best;
}

function zoomSpan(files: ChartFile[]): string {
  const mins = files.map((f) => f.minZoom).filter((n): n is number => n != null);
  const maxs = files.map((f) => f.maxZoom).filter((n): n is number => n != null);
  if (!mins.length || !maxs.length) return '';
  return `z${Math.min(...mins)}–${Math.max(...maxs)}`;
}

function shortDate(stamp: string): string {
  if (!stamp) return '';
  const day = stamp.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.slice(0, 7) : stamp.slice(0, 16);
}

function keyedOut(source: ChartSource, ctx: RankContext): boolean {
  if (source.needs === 'mapbox' && !ctx.keys.mapbox) return true;
  if (source.needs === 'google' && !ctx.keys.google) return true;
  if (source.needs === 'azure' && !ctx.keys.azure) return true;
  if (!source.liveId && source.secretEnv && !source.secretConfigured) return true;
  return false;
}

function coverageMiss(source: ChartSource, view: View): string | null {
  if (!source.coverageBbox) return null;
  if (intersects(source.coverageBbox, view.bbox)) return null;
  return source.outOfCoverageReason || 'Nothing in this view';
}

function nearestZoom(files: ChartFile[], zoom: number): number | null {
  const mins = files.map((f) => f.minZoom).filter((n): n is number => n != null);
  const maxs = files.map((f) => f.maxZoom).filter((n): n is number => n != null);
  if (!mins.length || !maxs.length) return null;
  const min = Math.min(...mins);
  const max = Math.max(...maxs);
  if (zoom < min) return min;
  if (zoom > max) return max;
  return null;
}

function badgeFor(_source: ChartSource, overlap: ChartFile[], atZoom: ChartFile[], reason: RowReason, zoom: number): string {
  if (reason === 'needsKey') return 'needs a key';
  if (reason === 'failing') return 'live tiles failing';
  if (reason === 'wrongZoom') {
    const z = nearestZoom(overlap, zoom);
    return z == null ? 'saved at another zoom' : `zoom to z${z}`;
  }
  if (reason === 'live') return 'live';
  const span = zoomSpan(atZoom.length ? atZoom : overlap);
  const when = shortDate(newestOf(atZoom.length ? atZoom : overlap));
  const n = (atZoom.length ? atZoom : overlap).length;
  const imported = (atZoom.length ? atZoom : overlap).every((f) => f.imported);
  if (imported) {
    const head = n > 1 ? `on this boat · ${n} areas` : 'on this boat';
    return [head, span].filter(Boolean).join(' · ');
  }
  const saved = span ? `saved ${span}` : 'saved';
  return when ? `${saved} · ${when}` : saved;
}

const BAND_ORDER: Record<ChartBand, number> = { live: 0, harvested: 1, downloaded: 2 };

export function rankForView(sources: ChartSource[], view: View, ctx: RankContext): RankResult {
  const rows: RankedRow[] = [];
  const getCharts: GetChart[] = [];
  let unreadable = 0;

  for (const source of sources) {
    if (source.role !== 'chart') continue;
    for (const file of source.files) {
      if (!file.bounds) unreadable += 1;
    }
    const overlap = source.files.filter((f) => hits(f.bounds, view.bbox, false));
    const atZoom = overlap.filter((f) => zoomCovers(f, view.zoom));
    if (overlap.length) {
      const reason: RowReason = atZoom.length ? 'cover' : 'wrongZoom';
      rows.push({
        source,
        overlap,
        atZoom,
        reason,
        dim: reason === 'wrongZoom',
        newest: newestOf(atZoom.length ? atZoom : overlap),
        badge: badgeFor(source, overlap, atZoom, reason, view.zoom),
      });
      continue;
    }
    if (source.liveId) {
      let reason: RowReason = 'live';
      if (keyedOut(source, ctx)) reason = 'needsKey';
      else if (ctx.liveFailing.has(source.liveId)) reason = 'failing';
      rows.push({
        source,
        overlap: [],
        atZoom: [],
        reason,
        dim: reason !== 'live',
        newest: '',
        badge: badgeFor(source, [], [], reason, view.zoom),
      });
      continue;
    }
    if (source.harvestId && (source.harvestable || source.stub)) {
      getCharts.push({
        source,
        reason: source.stub ? 'not downloadable yet' : coverageMiss(source, view),
      });
    }
  }

  rows.sort((a, b) => {
    const band = BAND_ORDER[chartBand(a)] - BAND_ORDER[chartBand(b)];
    if (band) return band;
    if (a.source.liveId || b.source.liveId) {
      const ia = LIVE_SORT.indexOf(a.source.id);
      const ib = LIVE_SORT.indexOf(b.source.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }
    const zoom = (a.reason === 'wrongZoom' ? 1 : 0) - (b.reason === 'wrongZoom' ? 1 : 0);
    if (zoom) return zoom;
    if (a.newest !== b.newest) return b.newest.localeCompare(a.newest);
    return a.source.label.localeCompare(b.source.label);
  });

  return { auto: pickAuto(rows, sources, ctx), rows, getCharts, unreadable };
}

function pickAuto(rows: RankedRow[], sources: ChartSource[], ctx: RankContext): ChartSource | null {
  const nautical = rows
    .filter((r) => r.reason === 'cover' && r.source.kind === 'nautical')
    .sort((a, b) => b.atZoom.length - a.atZoom.length || b.newest.localeCompare(a.newest));
  if (nautical[0]) return nautical[0].source;
  const imagery = rows
    .filter((r) => r.reason === 'cover' && r.source.kind !== 'nautical')
    .sort((a, b) => b.newest.localeCompare(a.newest));
  if (imagery[0]) return imagery[0].source;
  if (ctx.lastLiveId) {
    const live = rows.find((r) => r.source.liveId === ctx.lastLiveId && r.reason === 'live');
    if (live) return live.source;
  }
  return sources.find((s) => s.id === 'osm') ?? null;
}

export function resolveSource(choice: BasemapChoice, sources: ChartSource[], auto: ChartSource | null): ChartSource | null {
  if (choice.kind === 'auto') return auto;
  if (choice.kind === 'source' && choice.file) {
    const owner = sources.find((s) => s.files.some((f) => f.file === choice.file));
    if (owner) return owner;
  }
  const direct = sources.find((s) => s.id === choice.id);
  if (direct) return direct;
  if (choice.id.startsWith('import:')) {
    const slug = choice.id.slice('import:'.length);
    return sources.find((s) => s.files.some((f) => f.slug === slug)) ?? null;
  }
  return null;
}

/** Poseidon chart menu, in the same order as Poseidon. */
export const POSEIDON_CHARTS = [
  { slug: 'poseidon-nav', label: 'Nautical Chart' },
  { slug: 'poseidon-sonar', label: 'SonarChart' },
  { slug: 'poseidon-s57', label: 'S-57 ENC' },
  { slug: 'poseidon-s57-detail', label: 'S-57 ENC detail' },
] as const;

function poseidonSlug(source: ChartSource): string | null {
  return source.files.find((f) => f.slug?.startsWith('poseidon-'))?.slug ?? null;
}

/** Poseidon vector charts, listed as overlays on the chart picker. */
export function isPoseidonOverlay(source: ChartSource): boolean {
  return source.role === 'depth' && poseidonSlug(source) != null;
}

/** The name Poseidon shows for this chart, whatever the archive label says. */
export function poseidonChartLabel(source: ChartSource): string {
  const slug = poseidonSlug(source);
  return POSEIDON_CHARTS.find((chart) => chart.slug === slug)?.label ?? source.label;
}

/**
 * Poseidon-sonar and Poseidon-nav stay in the chart list even when the view
 * is outside their bounds. Depth shading does not use these rows.
 */
export function poseidonOverlayRows(sources: ChartSource[], view: View | null): RankedRow[] {
  const rows: RankedRow[] = [];
  for (const source of sources) {
    if (!isPoseidonOverlay(source)) continue;
    const overlap = view ? source.files.filter((f) => hits(f.bounds, view.bbox, false)) : [];
    const atZoom = view ? overlap.filter((f) => zoomCovers(f, view.zoom)) : [];
    const reason: RowReason = overlap.length ? (atZoom.length ? 'cover' : 'wrongZoom') : 'live';
    rows.push({
      source,
      overlap,
      atZoom,
      reason,
      dim: overlap.length === 0 || reason === 'wrongZoom',
      newest: newestOf(source.files),
      badge: overlap.length && view
        ? badgeFor(source, overlap, atZoom, reason, view.zoom)
        : 'outside this view',
    });
  }
  const order = POSEIDON_CHARTS.map((chart) => chart.slug as string);
  rows.sort((a, b) => {
    const ai = order.indexOf(poseidonSlug(a.source) ?? '');
    const bi = order.indexOf(poseidonSlug(b.source) ?? '');
    return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
  });
  return rows;
}

export function rankDepth(
  sources: ChartSource[],
  view: View,
  suggestedId: string | null,
): RankedRow[] {
  const rows: RankedRow[] = [];
  for (const source of sources) {
    if (source.role !== 'depth') continue;
    const overlap = source.files.filter((f) => hits(f.bounds, view.bbox, false));
    const outside = coverageMiss(source, view);
    if (!overlap.length && outside) continue;
    if (!overlap.length && !source.harvestable && !source.files.length) continue;
    const atZoom = overlap.filter((f) => zoomCovers(f, view.zoom));
    const reason: RowReason = overlap.length ? (atZoom.length ? 'cover' : 'wrongZoom') : 'live';
    rows.push({
      source,
      overlap,
      atZoom,
      reason,
      dim: reason === 'wrongZoom',
      newest: newestOf(overlap),
      badge: overlap.length
        ? badgeFor(source, overlap, atZoom, reason, view.zoom)
        : source.harvestable
          ? 'download'
          : 'live',
    });
  }
  rows.sort((a, b) => {
    const as = a.source.harvestId === suggestedId || a.source.id === suggestedId ? 0 : 1;
    const bs = b.source.harvestId === suggestedId || b.source.id === suggestedId ? 0 : 1;
    if (as !== bs) return as - bs;
    const af = a.overlap.length ? 0 : 1;
    const bf = b.overlap.length ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.source.label.localeCompare(b.source.label);
  });
  return rows;
}
