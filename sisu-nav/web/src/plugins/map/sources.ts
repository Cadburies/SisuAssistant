/**
 * One row per chart a sailor would name. Live imagery and its harvest twin
 * share a row. Imported archives group by family (Navionics, …), because
 * each import's meta.provider is its own slug.
 */
import type { Tileset } from '../../app/config.ts';
import type { Provider } from '../harvest/types.ts';
import { HARVEST_TWIN, LIVE_BASEMAPS, type LiveBasemapId } from './basemap.ts';
import { asBbox, type Bbox } from './geo.ts';

export type ChartFile = {
  id: string;
  file: string;
  slug: string | null;
  bounds: Bbox | null;
  minZoom: number | null;
  maxZoom: number | null;
  sourceDate: string | null;
  acquiredAt: string | null;
  label: string;
  imported: boolean;
  kind: string;
};

export type OverlaySlot = 'relief' | 'hillshade' | 'contours';

export type ChartSource = {
  id: string;
  label: string;
  role: 'chart' | 'depth';
  kind: 'nautical' | 'satellite' | 'bathymetry';
  liveId: LiveBasemapId | null;
  harvestId: string | null;
  needs: 'mapbox' | 'google' | 'azure' | null;
  secretEnv: string | null;
  secretConfigured: boolean;
  autoHarvest: boolean;
  stub: boolean;
  harvestable: boolean;
  coverageBbox: Bbox | null;
  outOfCoverageReason: string | null;
  overlay: OverlaySlot | null;
  files: ChartFile[];
  notes: string;
};

const FAMILIES: Array<{ id: string; label: string; test: RegExp }> = [
  { id: 'navionics-sonar', label: 'Navionics sonar', test: /navionics.*sonar|sonar.*navionics/i },
  { id: 'navionics', label: 'Navionics', test: /navionics/i },
  { id: 'cmap', label: 'C-Map', test: /c-?map/i },
  { id: 'nvcharts', label: 'NV Charts', test: /nv[\s-]*charts/i },
  { id: 'garmin', label: 'Garmin', test: /garmin/i },
  { id: 'ocharts', label: 'o-charts', test: /o-?charts/i },
  { id: 'sat2chart', label: 'Sat2Chart', test: /sat2chart/i },
  { id: 'noaa-import', label: 'NOAA', test: /\bnoaa\b/i },
  { id: 'cm93', label: 'CM93', test: /cm93/i },
  { id: 'saved-satellite', label: 'Satellite', test: /\bsatellite\b/i },
];

/** Sailor mbtiles use the product word in the folder name. Bing has no live service; Azure is that row. */
const SAT_TWIN: Array<{ test: RegExp; id: LiveBasemapId }> = [
  { test: /arcgis|\besri\b/i, id: 'esri' },
  { test: /googlesat|\bgoogle\b/i, id: 'google' },
  { test: /bingsat|\bbing\b/i, id: 'azure' },
];

/** Not a basemap unless a file is already on disk. */
const HIDDEN_UNLESS_FILES = new Set(['openseamap', 'apple-maps', 'bing-aerial']);

const TWIN_HARVEST = new Set(Object.keys(HARVEST_TWIN));

export function overlaySlot(id: string): OverlaySlot {
  if (/hillshade|ocean-rgb|seascape-dem/i.test(id)) return 'hillshade';
  if (/contour|seascape-vector|maptiler-ocean(?!-rgb)/i.test(id)) return 'contours';
  return 'relief';
}

function kindOf(raw: string | undefined): ChartSource['kind'] {
  if (raw === 'bathymetry' || raw === 'satellite' || raw === 'nautical') return raw;
  return 'nautical';
}

function blank(partial: Pick<ChartSource, 'id' | 'label' | 'role' | 'kind'> & Partial<ChartSource>): ChartSource {
  return {
    liveId: null,
    harvestId: null,
    needs: null,
    secretEnv: null,
    secretConfigured: true,
    autoHarvest: false,
    stub: false,
    harvestable: false,
    coverageBbox: null,
    outOfCoverageReason: null,
    overlay: partial.role === 'depth' ? 'relief' : null,
    files: [],
    notes: '',
    ...partial,
  };
}

function fileFrom(ts: Tileset): ChartFile {
  const slug = ts.file.startsWith('manual/') ? ts.file.split('/')[1] || null : null;
  return {
    id: ts.id,
    file: ts.file,
    slug,
    bounds: asBbox(ts.bounds),
    minZoom: ts.minZoom ?? null,
    maxZoom: ts.maxZoom ?? null,
    sourceDate: ts.sourceDate ?? null,
    acquiredAt: ts.acquiredAt ?? null,
    label: ts.label || ts.providerLabel || slug || ts.id,
    imported: Boolean(ts.imported || ts.file.startsWith('manual/')),
    kind: ts.kind,
  };
}

function familyFor(text: string): { id: string; label: string } | null {
  for (const f of FAMILIES) {
    if (f.test.test(text)) return f;
  }
  return null;
}

export function buildSources(providers: Provider[], tilesets: Tileset[]): ChartSource[] {
  const byId = new Map<string, ChartSource>();

  for (const live of LIVE_BASEMAPS) {
    byId.set(
      live.id,
      blank({
        id: live.id,
        label: live.id === 'azure' ? 'Azure imagery' : live.label,
        role: 'chart',
        kind: 'satellite',
        liveId: live.id,
        needs: live.needs ?? null,
        notes: live.id === 'azure' ? 'Replaces Bing Aerial' : '',
      }),
    );
  }
  const osm = byId.get('osm');
  if (osm) osm.kind = 'nautical';

  const harvestOf = new Map<string, ChartSource>();

  for (const p of providers) {
    const twin = HARVEST_TWIN[p.id];
    if (twin) {
      const row = byId.get(twin);
      if (!row) continue;
      row.harvestId = p.id;
      row.autoHarvest = p.autoHarvest !== false && !p.stub;
      row.stub = Boolean(p.stub);
      row.harvestable = p.harvestable && !p.stub;
      row.secretEnv = p.secretEnv ?? null;
      row.secretConfigured = p.secretConfigured;
      row.coverageBbox = asBbox(p.coverageBbox);
      row.outOfCoverageReason = p.outOfCoverageReason ?? null;
      row.notes = p.notes || row.notes;
      harvestOf.set(p.id, row);
      continue;
    }
    if (HIDDEN_UNLESS_FILES.has(p.id)) continue;
    if (p.kind !== 'bathymetry' && p.kind !== 'nautical' && p.kind !== 'satellite') continue;
    if (!p.harvestable && p.kind !== 'bathymetry') continue;
    const role = p.kind === 'bathymetry' ? 'depth' : 'chart';
    const row = blank({
      id: p.id,
      label: p.label,
      role,
      kind: kindOf(p.kind),
      harvestId: p.harvestable ? p.id : null,
      secretEnv: p.secretEnv ?? null,
      secretConfigured: p.secretConfigured,
      autoHarvest: p.autoHarvest !== false && !p.stub,
      stub: Boolean(p.stub),
      harvestable: p.harvestable && !p.stub,
      coverageBbox: asBbox(p.coverageBbox),
      outOfCoverageReason: p.outOfCoverageReason ?? null,
      overlay: role === 'depth' ? overlaySlot(p.id) : null,
      notes: p.notes || '',
    });
    byId.set(p.id, row);
    harvestOf.set(p.id, row);
  }

  type Loose = { file: ChartFile; text: string; labelKey: string; role: 'chart' | 'depth'; kind: ChartSource['kind'] };
  const loose: Loose[] = [];

  for (const ts of tilesets) {
    const file = fileFrom(ts);
    const parts = ts.file.split('/');
    const manual = ts.file.startsWith('manual/') || ts.imported;
    const providerId = ts.provider || (!manual && parts.length >= 2 ? parts[1] : null);
    if (providerId && harvestOf.has(providerId) && !manual) {
      harvestOf.get(providerId)?.files.push(file);
      continue;
    }
    if (providerId && TWIN_HARVEST.has(providerId) && !manual) {
      harvestOf.get(providerId)?.files.push(file);
      continue;
    }
    if (providerId && HIDDEN_UNLESS_FILES.has(providerId)) {
      let row = byId.get(providerId);
      if (!row) {
        row = blank({
          id: providerId,
          label: ts.providerLabel || ts.label || providerId,
          role: ts.kind === 'bathymetry' ? 'depth' : 'chart',
          kind: kindOf(ts.kind),
          overlay: ts.kind === 'bathymetry' ? overlaySlot(providerId) : null,
        });
        byId.set(providerId, row);
      }
      row.files.push(file);
      continue;
    }
    if (!manual) {
      const id = providerId || ts.id;
      let row = byId.get(id);
      if (!row) {
        const role = ts.kind === 'bathymetry' ? 'depth' : 'chart';
        row = blank({
          id,
          label: ts.providerLabel || ts.label || id,
          role,
          kind: kindOf(ts.kind),
          overlay: role === 'depth' ? overlaySlot(id) : null,
        });
        byId.set(id, row);
      }
      row.files.push(file);
      continue;
    }
    const role = ts.kind === 'bathymetry' ? 'depth' : 'chart';
    const text = `${ts.providerLabel || ''} ${ts.label || ''} ${file.slug || ''}`;
    if (role === 'chart') {
      const twin = SAT_TWIN.find((p) => p.test.test(text));
      const row = twin ? byId.get(twin.id) : undefined;
      if (row) {
        row.files.push(file);
        continue;
      }
    }
    loose.push({
      file,
      text,
      labelKey: (ts.providerLabel || ts.label || file.slug || ts.id).trim().toLowerCase(),
      role,
      kind: kindOf(ts.kind),
    });
  }

  const grouped = new Map<string, { label: string; role: 'chart' | 'depth'; kind: ChartSource['kind']; files: ChartFile[] }>();
  const pending: Loose[] = [];
  for (const item of loose) {
    const fam = familyFor(item.text);
    if (!fam) {
      pending.push(item);
      continue;
    }
    const key = `${item.role}:${fam.id}`;
    const g = grouped.get(key) || { label: fam.label, role: item.role, kind: item.kind, files: [] };
    g.files.push(item.file);
    grouped.set(key, g);
  }

  const byLabel = new Map<string, Loose[]>();
  for (const item of pending) {
    const key = `${item.role}:${item.labelKey}`;
    const list = byLabel.get(key) || [];
    list.push(item);
    byLabel.set(key, list);
  }
  for (const [key, items] of byLabel) {
    if (items.length >= 2) {
      const first = items[0];
      grouped.set(key, {
        label: first.file.label,
        role: first.role,
        kind: first.kind,
        files: items.map((i) => i.file),
      });
      continue;
    }
    const item = items[0];
    const id = `import:${item.file.slug || item.file.id}`;
    grouped.set(id, {
      label: item.file.label,
      role: item.role,
      kind: item.kind,
      files: [item.file],
    });
  }

  for (const [key, g] of grouped) {
    // chart:navionics → navionics. depth: and import: keep the prefix so they
    // don't collide with a chart family of the same name.
    const sourceId = key.startsWith('chart:') ? key.slice('chart:'.length) : key;
    if (byId.has(sourceId)) {
      byId.get(sourceId)?.files.push(...g.files);
      continue;
    }
    byId.set(
      sourceId,
      blank({
        id: sourceId,
        label: g.label,
        role: g.role,
        kind: g.role === 'depth' ? 'bathymetry' : g.kind,
        overlay: g.role === 'depth' ? 'relief' : null,
        files: g.files,
      }),
    );
  }

  return [...byId.values()];
}
