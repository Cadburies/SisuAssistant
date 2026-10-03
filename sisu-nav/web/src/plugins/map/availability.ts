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

const LIVE_SORT = ['esri', 'google', 'mapbox', 'azure', 'osm'];

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

function badgeFor(source: ChartSource, overlap: ChartFile[], atZoom: ChartFile[], reason: RowReason, zoom: number): string {
  if (reason === 'needsKey') return 'needs a key';
  if (reason === 'failing') return 'live tiles failing';
  if (reason === 'wrongZoom') {
    const z = nearestZoom(overlap, zoom);
    return z == null ? 'saved at another zoom' : `zoom to z${z}`;
  }
  if (reason === 'live') {
    return source.liveId === 'azure' ? 'live · replaces Bing' : 'live';
  }
  const span = zoomSpan(atZoom.length ? atZoom : overlap);
  const when = shortDate(newestOf(atZoom.length ? atZoom : overlap));
  const n = (atZoom.length ? atZoom : overlap).length;
  if (source.files.some((f) => f.imported) && !source.liveId) {
    const head = n > 1 ? `on this boat · ${n} areas` : 'on this boat';
    return [head, span].filter(Boolean).join(' · ');
  }
  const saved = span ? `saved ${span}` : 'saved';
  const dated = when ? `${saved} · ${when}` : saved;
  return source.liveId ? `${dated} · live fills gaps` : dated;
}

function groupOf(row: RankedRow): number {
  if (row.reason === 'cover' && row.source.kind === 'nautical') return 0;
  if (row.reason === 'cover') return 1;
  if (row.reason === 'wrongZoom') return 2;
  return 3;
}

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
    const g = groupOf(a) - groupOf(b);
    if (g) return g;
    if (a.newest !== b.newest) return b.newest.localeCompare(a.newest);
    const ia = LIVE_SORT.indexOf(a.source.id);
    const ib = LIVE_SORT.indexOf(b.source.id);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
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
  const direct = sources.find((s) => s.id === choice.id);
  if (direct) return direct;
  if (choice.id.startsWith('import:')) {
    const slug = choice.id.slice('import:'.length);
    return sources.find((s) => s.files.some((f) => f.slug === slug)) ?? null;
  }
  return null;
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
