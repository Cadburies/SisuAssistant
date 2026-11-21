import { useEffect, useMemo, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { loadTilesets, type RuntimeConfig, type Tileset } from '../../app/config';
import type { PluginProps } from '../../app/plugin';
import { fetchProviders } from '../harvest/api';
import { HarvestSources } from '../harvest/HarvestPanel';
import type { Provider } from '../harvest/types';
import {
  chartBand,
  isPoseidonOverlay,
  poseidonChartLabel,
  poseidonOverlayRows,
  rankDepth,
  rankForView,
  type RankedRow,
  type RankResult,
} from '../map/availability';
import {
  addBaseLayer,
  getBaseStack,
  getBasemap,
  getLastLive,
  moveBaseLayer,
  noteLive,
  removeBaseLayer,
  setBaseOpacity,
  setBasemapChoice,
  subscribeBasemap,
  type BasemapChoice,
} from '../map/basemap';
import { clearLiveFailing, liveFailing, subscribeLiveHealth } from '../map/liveHealth';
import {
  applyChartPreset,
  CHART_DETAIL_PRESETS,
  chartPreset,
  groupActiveCount,
  isLayerOn,
  LAYER_GROUPS,
  layerBlockReason,
  listLayers,
  setLayerOn,
  subscribeLayers,
  type ChartDetailPreset,
  type LayerGroup,
  type LayerId,
} from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { buildSources, type ChartSource } from '../map/sources';
import {
  getDepthPicks,
  isDepthPinned,
  setDepthPick,
  setDepthPinned,
  subscribeDepth,
} from '../bathy/choice';
import {
  getImportOpacity,
  listEnabledImports,
  setImportOn,
  setImportOpacity,
  subscribeImports,
} from '../imported/state';
import './layers.css';

export type MapSheetTab = 'base' | 'overlays' | 'downloads';

const TAB_TITLE: Record<MapSheetTab, string> = {
  base: 'Base',
  overlays: 'Overlays',
  downloads: 'Downloads',
};

function readView(map: MapLibreMap): { bbox: [number, number, number, number]; zoom: number } {
  const b = map.getBounds();
  return {
    bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    zoom: Math.round(map.getZoom()),
  };
}

function useMapSources(config: RuntimeConfig) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tilesets, setTilesets] = useState<Tileset[]>([]);
  const [view, setView] = useState<{ bbox: [number, number, number, number]; zoom: number } | null>(null);
  const [failTick, setFailTick] = useState(0);

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLiveHealth(() => setFailTick((n) => n + 1)), []);

  useEffect(() => {
    let stop = false;
    const load = () => {
      fetchProviders()
        .then((rows) => {
          if (!stop) setProviders(rows);
        })
        .catch(() => {});
    };
    load();
    const t = window.setInterval(load, 10_000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const load = () => {
      loadTilesets()
        .then((rows) => {
          if (!stop) setTilesets(rows);
        })
        .catch(() => {});
    };
    load();
    const t = window.setInterval(load, 3000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!map) return;
    const read = () => setView(readView(map));
    let t = 0;
    const onMove = () => {
      window.clearTimeout(t);
      t = window.setTimeout(read, 250);
    };
    read();
    map.on('moveend', onMove);
    return () => {
      map.off('moveend', onMove);
      window.clearTimeout(t);
    };
  }, [map]);

  const sources = useMemo(() => buildSources(providers, tilesets), [providers, tilesets]);
  const failing = useMemo(() => {
    void failTick;
    return new Set(liveFailing());
  }, [failTick]);
  const ranked = useMemo(() => {
    if (!view) return null;
    return rankForView(sources, view, {
      keys: {
        mapbox: Boolean(config.mapboxToken),
        google: config.googleConfigured,
        azure: config.azureConfigured,
      },
      liveFailing: failing,
      lastLiveId: getLastLive(),
    });
  }, [sources, view, config.mapboxToken, config.googleConfigured, config.azureConfigured, failing]);

  return { map, sources, ranked, view };
}

function bandLabel(row: RankedRow): 'Live' | 'Saved' | 'USB' {
  return chartBand(row) === 'live' ? 'Live' : chartBand(row) === 'downloaded' ? 'USB' : 'Saved';
}

function sourceById(sources: ChartSource[], id: string): ChartSource | null {
  return sources.find((s) => s.id === id) ?? null;
}

function BaseTab({
  sources,
  ranked,
  choice,
}: {
  sources: ChartSource[];
  ranked: RankResult | null;
  choice: BasemapChoice;
}) {
  const [, bump] = useState(0);
  useEffect(() => subscribeBasemap(() => bump((n) => n + 1)), []);
  const stack = getBaseStack();
  const activeId = choice.kind === 'source' ? choice.id : null;

  const families = useMemo(() => {
    const out = new Map<string, { label: string; entries: Array<{ row: RankedRow; source: ChartSource; band: 'Live' | 'Saved' | 'USB' }> }>();
    for (const row of ranked?.rows ?? []) {
      const source = row.source;
      if (source.contentRole !== 'base') continue;
      const key = source.familyId;
      const cur = out.get(key) ?? { label: source.label, entries: [] };
      if (!cur.entries.some((e) => e.source.id === source.id)) {
        cur.entries.push({ row, source, band: bandLabel(row) });
      }
      out.set(key, cur);
    }
    for (const entry of out.values()) {
      entry.entries.sort((a, b) => (a.band === 'Live' ? -1 : b.band === 'Live' ? 1 : a.band.localeCompare(b.band)));
    }
    return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [ranked]);

  const unknown = sources.filter((s) => s.contentRole === 'unknown' && s.files.length > 0);

  const choose = (source: ChartSource) => {
    noteLive(source.liveId);
    if (source.liveId) clearLiveFailing(source.liveId);
    setBasemapChoice({ kind: 'source', id: source.id });
  };

  return (
    <div className="sisu-ms-section">
      <div className="sisu-ms-note">
        Base is a stack, not a single choice. The primary below wins for Auto; extra bases sit above it.
      </div>
      <label className={`sisu-ms-row${choice.kind === 'auto' ? ' active' : ''}`}>
        <input type="radio" name="sisu-base" checked={choice.kind === 'auto'} onChange={() => setBasemapChoice({ kind: 'auto' })} />
        <span>
          <strong>Auto</strong>
          <span className="sisu-ms-muted">{ranked?.auto?.label || 'OpenStreetMap'}</span>
        </span>
      </label>

      {families.length === 0 ? <p className="sisu-ms-muted">No base source covers this view.</p> : null}
      {families.map((family) => (
        <div key={family.label} className="sisu-ms-family">
          <div className="sisu-ms-family-label">{family.label}</div>
          <div className="sisu-ms-chips">
            {family.entries.map(({ source, band }) => (
              <button
                key={source.id}
                type="button"
                className={`sisu-ms-chip${activeId === source.id ? ' active' : ''}`}
                title={source.notes || source.label}
                onClick={() => choose(source)}
              >
                {band}
              </button>
            ))}
            {family.entries.some((e) => e.source.files.length > 0) ? (
              <button
                type="button"
                className="sisu-ms-add"
                title="Add this family as an extra base layer"
                onClick={() => {
                  const withFiles = family.entries.find((e) => e.source.files.length > 0);
                  if (withFiles) addBaseLayer(withFiles.source.id);
                }}
              >
                + stack
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {unknown.length ? (
        <div className="sisu-ms-unknown">
          <p className="sisu-ms-family-label">Unsorted manual</p>
          {unknown.map((source) => (
            <p key={source.id} className="sisu-ms-muted">
              <strong>{source.label}</strong> — {source.contentReason || 'ambiguous import'}
            </p>
          ))}
        </div>
      ) : null}

      <div className="sisu-ms-subhead">Base stack</div>
      {stack.length === 0 ? <p className="sisu-ms-muted">No extra base layers.</p> : null}
      {stack.map((entry) => {
        const source = sourceById(sources, entry.sourceId);
        return (
          <div key={entry.sourceId} className="sisu-ms-stack-row">
            <span>{source?.label || entry.sourceId}</span>
            <label className="sisu-ms-opacity">
              <span>{Math.round(entry.opacity * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={entry.opacity}
                onChange={(e) => setBaseOpacity(entry.sourceId, Number(e.target.value))}
              />
            </label>
            <button type="button" className="sisu-ms-mini" aria-label="Move base up" onClick={() => moveBaseLayer(entry.sourceId, -1)}>↑</button>
            <button type="button" className="sisu-ms-mini" aria-label="Move base down" onClick={() => moveBaseLayer(entry.sourceId, 1)}>↓</button>
            <button type="button" className="sisu-ms-mini" aria-label="Remove base" onClick={() => removeBaseLayer(entry.sourceId)}>×</button>
          </div>
        );
      })}
    </div>
  );
}

function OverlaysTab({
  sources,
  view,
}: {
  sources: ChartSource[];
  view: { bbox: [number, number, number, number]; zoom: number } | null;
}) {
  const [, bump] = useState(0);
  const [openGroups, setOpenGroups] = useState<Set<LayerGroup>>(() => new Set(LAYER_GROUPS.map((g) => g.id)));
  const [importsOn, setImportsOn] = useState(() => listEnabledImports());
  const [depthPicks, setDepthPicks] = useState(() => getDepthPicks());
  const [pinned, setPinned] = useState(() => isDepthPinned());
  const [importOpacity, setImportOpacityState] = useState(() => ({}) as Record<string, number>);

  useEffect(() => subscribeLayers(() => bump((n) => n + 1)), []);
  useEffect(() => subscribeImports(() => setImportsOn(listEnabledImports())), []);
  useEffect(() => subscribeDepth(() => {
    setDepthPicks(getDepthPicks());
    setPinned(isDepthPinned());
  }), []);

  const rows = listLayers();
  const poseidon = poseidonOverlayRows(sources, view);
  const imported = [
    ...new Map(
      sources
        .flatMap((source) => {
          const files = source.files.filter((f) => f.imported && f.slug);
          if (!files.length) return [];
          return [{ source, slug: files[0].slug as string, files }];
        })
        .map((item) => [`${item.source.contentRole}:${item.source.familyId}`, item]),
    ).values(),
  ];
  const seafloorImports = imported.filter((i) => i.source.contentRole === 'seafloor');
  const chartImports = imported.filter(
    (i) => i.source.contentRole === 'base' || (i.source.contentRole === 'chart-overlay' && !isPoseidonOverlay(i.source)),
  );
  const importedRow = ({ source, slug, files }: { source: ChartSource; slug: string; files: ChartSource['files'] }) => {
    const slugs = files.map((f) => f.slug).filter((s): s is string => Boolean(s));
    const on = slugs.some((s) => importsOn.has(s));
    const opacity = importOpacity[slug] ?? getImportOpacity(slug);
    return (
      <div key={`${source.contentRole}:${source.familyId}`} className="sisu-ms-imported-row">
        <label className="sisu-ms-inline">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => {
              for (const s of slugs) setImportOn(s, e.target.checked);
            }}
          />
          {source.label}
        </label>
        {on ? (
          <label className="sisu-ms-opacity">
            <span>{Math.round(opacity * 100)}%</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => {
                const next = Number(e.target.value);
                for (const s of slugs) setImportOpacity(s, next);
                setImportOpacityState((cur) => ({ ...cur, [slug]: next }));
              }}
            />
          </label>
        ) : null}
      </div>
    );
  };
  const depthRows = view
    ? [
        ...new Map(
          rankDepth(sources, view, null)
            .filter((r) => !isPoseidonOverlay(r.source) && !r.source.files.some((f) => f.imported))
            .map((r) => [r.source.familyId, r]),
        ).values(),
      ]
    : [];
  const activeDepth = depthPicks.relief || depthRows[0]?.source.id || '';

  const setPoseidon = (slug: string | null) => {
    for (const row of poseidon) {
      for (const f of row.source.files) {
        if (f.slug?.startsWith('poseidon-')) setImportOn(f.slug, f.slug === slug);
      }
    }
  };

  return (
    <div className="sisu-ms-section">
      <div className="sisu-ms-subhead">Sea floor</div>
      <label className="sisu-ms-field">
        <span>Source</span>
        <select
          value={activeDepth}
          onChange={(e) => {
            const id = e.target.value;
            const row = depthRows.find((r) => r.source.id === id || r.source.harvestId === id);
            if (row?.source.overlay) {
              setDepthPick(row.source.overlay, id);
              setDepthPinned(true);
            }
          }}
        >
          <option value="">None here</option>
          {depthRows.map((r) => (
            <option key={r.source.id} value={r.source.harvestId || r.source.id}>
              {r.source.label}
            </option>
          ))}
        </select>
      </label>
      <label className="sisu-ms-inline">
        <input type="checkbox" checked={pinned} onChange={(e) => setDepthPinned(e.target.checked)} />
        Pin source
      </label>
      {seafloorImports.map(importedRow)}

      <div className="sisu-ms-subhead">Nautical chart</div>
      <label className="sisu-ms-field">
        <span>Detail</span>
        <select
          value={chartPreset()}
          onChange={(e) => {
            const next = e.target.value;
            if (next !== 'custom') applyChartPreset(next as ChartDetailPreset);
          }}
        >
          {chartPreset() === 'custom' ? <option value="custom">Custom</option> : null}
          {CHART_DETAIL_PRESETS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>
      {poseidon.length ? (
        <div className="sisu-ms-radio-list">
          <label className="sisu-ms-inline">
            <input type="radio" name="sisu-poseidon" checked={!poseidon.some((r) => r.source.files.some((f) => f.slug && importsOn.has(f.slug)))} onChange={() => setPoseidon(null)} />
            None
          </label>
          {poseidon.map((row) => {
            const slug = row.source.files.find((f) => f.slug?.startsWith('poseidon-'))?.slug ?? null;
            return (
              <label key={row.source.id} className="sisu-ms-inline">
                <input type="radio" name="sisu-poseidon" checked={Boolean(slug && importsOn.has(slug))} onChange={() => setPoseidon(slug)} />
                {poseidonChartLabel(row.source)}
              </label>
            );
          })}
        </div>
      ) : null}
      {chartImports.map(importedRow)}

      {LAYER_GROUPS.map((group) => {
        const defs = rows.filter((r) => r.group === group.id);
        if (!defs.length) return null;
        const open = openGroups.has(group.id);
        return (
          <div key={group.id} className="sisu-ms-group">
            <button
              type="button"
              className="sisu-ms-group-head"
              aria-expanded={open}
              onClick={() =>
                setOpenGroups((cur) => {
                  const next = new Set(cur);
                  if (next.has(group.id)) next.delete(group.id);
                  else next.add(group.id);
                  return next;
                })
              }
            >
              <span>{open ? '▾' : '▸'} {group.title}</span>
              <span className="sisu-ms-muted">{groupActiveCount(group.id)} on</span>
            </button>
            {open ? (
              <div className="sisu-ms-group-body">
                {defs.map((def) => {
                  const on = isLayerOn(def.id as LayerId);
                  const why = layerBlockReason(def.id as LayerId);
                  return (
                    <label key={def.id} className={`sisu-ms-layer${why ? ' blocked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={Boolean(why && !on)}
                        onChange={() => setLayerOn(def.id as LayerId, !on)}
                      />
                      <span>{def.label}</span>
                      {why ? <span className="sisu-ms-muted">{why}</span> : null}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      <p className="sisu-ms-muted">Depth shading is not for navigation.</p>
    </div>
  );
}

export function MapSheet({
  config,
  sk,
  initialTab = 'base',
  onClose,
}: PluginProps & { initialTab?: MapSheetTab; onClose: () => void }) {
  const [tab, setTab] = useState<MapSheetTab>(initialTab);
  const [choice, setChoice] = useState(getBasemap);
  const { sources, ranked, view } = useMapSources(config);

  useEffect(() => setTab(initialTab), [initialTab]);
  useEffect(() => subscribeBasemap(() => setChoice(getBasemap())), []);

  return (
    <div
      className="sisu-ms"
      role="dialog"
      aria-label="Map sources"
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div className="sisu-ms-top">
        <strong>Map sources</strong>
        <button type="button" className="sisu-ms-close" aria-label="Close map sources" onClick={onClose}>×</button>
      </div>
      <div className="sisu-ms-tabs" role="tablist">
        {(Object.keys(TAB_TITLE) as MapSheetTab[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {TAB_TITLE[id]}
          </button>
        ))}
      </div>
      {tab === 'base' ? <BaseTab sources={sources} ranked={ranked} choice={choice} /> : null}
      {tab === 'overlays' ? <OverlaysTab sources={sources} view={view} /> : null}
      {tab === 'downloads' ? (
        <div className="sisu-ms-section">
          <HarvestSources config={config} sk={sk} />
        </div>
      ) : null}
    </div>
  );
}

/** Kept for the chart row’s “Layers” action and old callers. */
export function openMapSheet(tab: MapSheetTab = 'base'): void {
  window.dispatchEvent(new CustomEvent('sisu-open-layers', { detail: { tab } }));
}

/** Re-export so a caller can open the sheet without importing the whole module. */
export function sourceLabel(sources: ChartSource[], id: string): string {
  return sourceById(sources, id)?.label ?? id;
}
