import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { loadTilesets } from '../../app/config';
import type { PluginProps } from '../../app/plugin';
import { BathySync } from '../bathy/BathySync';
import { LiveBasemapSync } from '../basemaps/BasemapsPanel';
import { ImportPanel } from '../imported/ImportPanel';
import { ImportSync } from '../imported/ImportSync';
import { chartBand, rankForView, resolveSource, type ChartBand, type RankedRow } from '../map/availability';
import {
  getBasemap,
  getLastLive,
  noteLive,
  refreshBasemap,
  setBasemapChoice,
  subscribeBasemap,
  type BasemapChoice,
  type LiveBasemapId,
} from '../map/basemap';
import { splitBbox, type Bbox } from '../map/geo';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { clearLiveFailing, liveFailing, subscribeLiveHealth } from '../map/liveHealth';
import { subscribeNavMap } from '../map/registry';
import { buildSources, type ChartFile, type ChartSource } from '../map/sources';
import { fetchJobs, fetchProviders, resumeJob } from './api';
import { DepthBlock } from './DepthBlock';
import { SecretField } from './SecretField';
import type { Job, Provider } from './types';
import { useViewHarvest } from './useViewHarvest';
import './harvest.css';

const BBOX_SOURCE = 'harvest-bbox';

/** Coarse boxes, checked in order. BVI is before USVI because the boxes overlap. */
const PLACES: Array<{ name: string; box: Bbox }> = [
  { name: 'BVI', box: [-65.1, 18.2, -64.2, 18.8] },
  { name: 'USVI', box: [-65.2, 17.6, -64.5, 18.4] },
  { name: 'Puerto Rico', box: [-67.3, 17.9, -65.6, 18.6] },
  { name: 'St Martin', box: [-63.2, 17.95, -62.9, 18.15] },
  { name: 'Antigua', box: [-62.15, 16.9, -61.65, 17.2] },
  { name: 'Guadeloupe', box: [-61.85, 15.8, -61.0, 16.55] },
  { name: 'Martinique', box: [-61.25, 14.35, -60.8, 14.9] },
  { name: 'St Lucia', box: [-61.1, 13.7, -60.85, 14.15] },
  { name: 'St Vincent', box: [-61.3, 13.1, -61.05, 13.4] },
  { name: 'Grenada', box: [-61.85, 11.95, -61.35, 12.35] },
  { name: 'Barbados', box: [-59.7, 13.0, -59.4, 13.35] },
];

function placeLabel(bbox: Bbox | null, zoom: number | null): string {
  if (!bbox || zoom == null) return '…';
  const lat = (bbox[1] + bbox[3]) / 2;
  const lon = (bbox[0] + bbox[2]) / 2;
  const z = `z${zoom}`;
  const hit = PLACES.find((p) => lon >= p.box[0] && lon <= p.box[2] && lat >= p.box[1] && lat <= p.box[3]);
  if (hit) return `${hit.name} · ${z}`;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew} · ${z}`;
}

function readView(map: MapLibreMap): { bbox: Bbox; zoom: number } {
  const b = map.getBounds();
  return {
    bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    zoom: Math.round(map.getZoom()),
  };
}

function boxesFeature(files: ChartFile[]) {
  const features = [];
  for (const file of files) {
    if (!file.bounds) continue;
    for (const [w, s, e, n] of splitBbox(file.bounds)) {
      features.push({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
      });
    }
  }
  return { type: 'FeatureCollection' as const, features };
}

function ensureBboxLayer(map: MapLibreMap) {
  if (map.getSource(BBOX_SOURCE)) return;
  map.addSource(BBOX_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: `${BBOX_SOURCE}-fill`,
    type: 'fill',
    source: BBOX_SOURCE,
    paint: { 'fill-color': '#e0b43a', 'fill-opacity': 0.08 },
  });
  map.addLayer({
    id: `${BBOX_SOURCE}-line`,
    type: 'line',
    source: BBOX_SOURCE,
    paint: { 'line-color': '#e0b43a', 'line-width': 1.5, 'line-dasharray': [2, 1] },
  });
}

function statusClass(status: Job['status'], failed?: number): string {
  switch (status) {
    case 'done':
    case 'skipped':
      return failed ? 'hv-wait' : 'hv-ok';
    case 'error':
    case 'interrupted':
      return 'hv-bad';
    case 'unsupported':
      return 'hv-wait';
    default:
      return 'hv-muted';
  }
}

function jobLabel(j: Job): string {
  if (j.status === 'skipped') return 'skipped';
  const failedSuffix = j.failed ? ` (${j.failed} unavailable)` : '';
  if (j.mode === 'fill' && j.status === 'done') {
    if (!j.fetched) return `filled 0 — none landed${failedSuffix}`;
    return `filled ${j.fetched}${failedSuffix}`;
  }
  if (j.mode === 'fill') return 'fill';
  if (j.status === 'done') return `done${failedSuffix}`;
  return j.status;
}

export function HarvestPanel({ config, sk }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tilesets, setTilesets] = useState<Awaited<ReturnType<typeof loadTilesets>>>([]);
  const [choice, setChoice] = useState(getBasemap);
  const [view, setView] = useState<{ bbox: Bbox; zoom: number } | null>(null);
  const [failTick, setFailTick] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pressId, setPressId] = useState<string | null>(null);
  const [openAreas, setOpenAreas] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [time, setTime] = useState('');
  const pressTimer = useRef<number | null>(null);

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeBasemap(() => setChoice(getBasemap())), []);
  useEffect(() => subscribeLiveHealth(() => setFailTick((n) => n + 1)), []);

  const reloadProviders = useCallback(() => {
    fetchProviders()
      .then(setProviders)
      .catch(() => {});
  }, []);

  useEffect(() => {
    reloadProviders();
  }, [reloadProviders]);

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
    let stop = false;
    const tick = () => {
      fetchJobs()
        .then((rows) => {
          if (!stop) setJobs(rows);
        })
        .catch(() => {});
    };
    tick();
    const t = window.setInterval(tick, 4000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);

  const doneSeen = useRef(new Set<string>());
  useEffect(() => {
    let bump = false;
    for (const j of jobs) {
      if (j.status === 'done' && (j.fetched || 0) > 0 && !doneSeen.current.has(j.id)) {
        doneSeen.current.add(j.id);
        bump = true;
      }
    }
    if (bump) refreshBasemap();
  }, [jobs]);

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

  const failing = useMemo(() => {
    void failTick;
    return new Set(liveFailing());
  }, [failTick]);

  const sources = useMemo(() => buildSources(providers, tilesets), [providers, tilesets]);
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

  const screen = ranked ? resolveSource(choice, sources, ranked.auto) : null;
  const screenHarvestId = screen?.harvestId ?? null;
  const screenProvider = useMemo(
    () => (screenHarvestId ? providers.find((p) => p.id === screenHarvestId) ?? null : null),
    [providers, screenHarvestId],
  );
  const harvest = useViewHarvest(screenProvider, time, true);

  const selectedId = choice.kind === 'auto' ? null : screen?.id ?? null;
  const outlineId = pressId || hoverId || (choice.kind === 'auto' ? ranked?.auto?.id ?? null : selectedId);
  const outlineFiles = useMemo(() => {
    if (!ranked || !outlineId) return [];
    const row = ranked.rows.find((r) => r.source.id === outlineId);
    if (!row) return [];
    if (!pressId && !hoverId && choice.kind === 'source' && choice.file) {
      return row.overlap.filter((f) => f.file === choice.file);
    }
    return row.overlap;
  }, [ranked, outlineId, pressId, hoverId, choice]);

  useEffect(() => {
    if (!map) return;
    const apply = () => {
      try {
        if (!map.isStyleLoaded()) return;
        const src = map.getSource(BBOX_SOURCE) as GeoJSONSource | undefined;
        if (!isLayerOn('chart-coverage')) {
          src?.setData({ type: 'FeatureCollection', features: [] });
          return;
        }
        ensureBboxLayer(map);
        const next = map.getSource(BBOX_SOURCE) as GeoJSONSource | undefined;
        next?.setData(boxesFeature(outlineFiles));
      } catch {
        /* style is swapping */
      }
    };
    apply();
    map.on('idle', apply);
    const unsub = subscribeLayers(apply);
    return () => {
      map.off('idle', apply);
      unsub();
    };
  }, [map, outlineFiles]);

  const choose = (next: BasemapChoice, live?: LiveBasemapId | null) => {
    if (live) {
      noteLive(live);
      clearLiveFailing(live);
    }
    setBasemapChoice(next);
  };

  const armPress = (id: string) => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPressId(id), 450);
  };
  const disarmPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    setPressId(null);
  };

  const missing =
    choice.kind === 'source' && screen && ranked && !ranked.rows.some((r) => r.source.id === screen.id)
      ? screen
      : null;
  const fileOutside =
    choice.kind === 'source' &&
    choice.file &&
    screen &&
    ranked?.rows.some((r) => r.source.id === screen.id) &&
    !ranked.rows.some((r) => r.source.id === screen.id && r.overlap.some((f) => f.file === choice.file));

  const activeJob = jobs.find(
    (j) =>
      screenProvider &&
      j.providerId === screenProvider.id &&
      (j.status === 'running' || j.status === 'queued'),
  );
  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobs],
  );

  return (
    <section className="hv">
      <LiveBasemapSync config={config} sk={sk} />
      <BathySync config={config} sk={sk} />
      <ImportSync config={config} sk={sk} />

      <div className="hv-head">
        <span>{placeLabel(view?.bbox ?? null, view?.zoom ?? null)}</span>
      </div>

      {sheet && ranked ? (
        <GetSheet
          items={ranked.getCharts}
          unreadable={ranked.unreadable}
          providers={providers}
          onBack={() => setSheet(false)}
          onUse={(id, liveId) => {
            choose({ kind: 'source', id }, liveId);
            setSheet(false);
          }}
          onReload={reloadProviders}
        />
      ) : (
        <>
          <label className={`hv-src${choice.kind === 'auto' ? ' on' : ''}`}>
            <span className="hv-src-main">
              <input
                type="radio"
                name="sisu-chart"
                checked={choice.kind === 'auto'}
                onChange={() => choose({ kind: 'auto' })}
              />
              <span>
                <span className="hv-src-name">Auto</span>
                <span className="hv-muted">{ranked?.auto?.label || 'OpenStreetMap'}</span>
              </span>
            </span>
          </label>

          {missing ? (
            <div className="hv-src on">
              <span className="hv-src-main">
                <input type="radio" name="sisu-chart" checked readOnly />
                <span>
                  <span className="hv-src-name">{missing.label}</span>
                  <span className="hv-muted">nothing in this view</span>
                </span>
              </span>
            </div>
          ) : null}

          {ranked
            ? (['live', 'harvested', 'downloaded'] as ChartBand[]).map((band) => {
                const rows = ranked.rows.filter((row) => chartBand(row) === band);
                if (!rows.length) return null;
                const title = band === 'live' ? 'Live' : band === 'harvested' ? 'Harvested' : 'Downloaded';
                return (
                  <div key={band} className="hv-band">
                    <p className="hv-band-title">{title}</p>
                    {rows.map((row) => (
                      <ChartRow
                        key={row.source.id}
                        row={row}
                        selected={selectedId === row.source.id}
                        file={choice.kind === 'source' && choice.id === row.source.id ? choice.file : undefined}
                        areasOpen={openAreas === row.source.id}
                        onToggleAreas={() => setOpenAreas(openAreas === row.source.id ? null : row.source.id)}
                        onSelect={() => choose({ kind: 'source', id: row.source.id }, row.source.liveId)}
                        onSelectFile={(file) => choose({ kind: 'source', id: row.source.id, file }, row.source.liveId)}
                        onHover={(on) => setHoverId(on ? row.source.id : null)}
                        onPress={() => armPress(row.source.id)}
                        onRelease={disarmPress}
                      />
                    ))}
                  </div>
                );
              })
            : null}

          {fileOutside ? <p className="hv-wait">That area is outside this view.</p> : null}

          <ChartDetail
            source={screen}
            followingAuto={choice.kind === 'auto'}
            provider={screenProvider}
            harvest={harvest}
            activeJob={activeJob ?? null}
            time={time}
            onTime={setTime}
            onReload={reloadProviders}
          />

          <div className="hv-row">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setDrawer(false);
                setSheet(true);
              }}
            >
              Get charts for this view
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setDrawer((v) => !v)}
            >
              {drawer ? 'Close USB' : 'Add from USB'}
            </button>
          </div>

          {drawer ? (
            <div className="hv-drawer">
              <ImportPanel config={config} sk={sk} />
            </div>
          ) : null}

          <DepthBlock
            sources={sources}
            providers={providers}
            view={view}
            onReloadProviders={reloadProviders}
          />
        </>
      )}

      <div className="hv-jobs">
        <button type="button" className="hv-disclosure" onClick={() => setJobsOpen((v) => !v)}>
          <span>{jobsOpen ? '▾' : '▸'} Jobs ({sortedJobs.length})</span>
        </button>
        {jobsOpen ? (
          sortedJobs.length === 0 ? (
            <p className="hv-muted">No harvest jobs yet.</p>
          ) : (
            sortedJobs.map((j) => (
              <div key={j.id} className="hv-job">
                <div className="hv-job-top">
                  <span className={statusClass(j.status, j.failed)}>{jobLabel(j)}</span>
                  <span>{j.providerLabel}</span>
                </div>
                <div className="hv-muted mono">
                  {j.region}
                  {j.sourceDate ? ` · ${j.sourceDate}` : ''}
                </div>
                {j.status === 'running' || j.status === 'queued' ? (
                  <div className="hv-bar">
                    <div
                      className="hv-bar-fill"
                      style={{ width: `${j.total ? (100 * j.completed) / j.total : 0}%` }}
                    />
                  </div>
                ) : null}
                {j.error ? <p className="hv-note">{j.error}</p> : null}
                {j.status === 'error' || j.status === 'interrupted' ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => resumeJob(j.id).then(() => fetchJobs().then(setJobs))}
                  >
                    Resume
                  </button>
                ) : null}
              </div>
            ))
          )
        ) : null}
      </div>
    </section>
  );
}

function ChartRow({
  row,
  selected,
  file,
  areasOpen,
  onToggleAreas,
  onSelect,
  onSelectFile,
  onHover,
  onPress,
  onRelease,
}: {
  row: RankedRow;
  selected: boolean;
  file?: string;
  areasOpen: boolean;
  onToggleAreas: () => void;
  onSelect: () => void;
  onSelectFile: (file: string) => void;
  onHover: (on: boolean) => void;
  onPress: () => void;
  onRelease: () => void;
}) {
  const many = row.overlap.length > 1;
  return (
    <div
      className={`hv-src${selected ? ' on' : ''}${row.dim ? ' dim' : ''}`}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') onHover(true);
      }}
      onPointerLeave={() => onHover(false)}
      onPointerDown={onPress}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
    >
      <label className="hv-src-main">
        <input type="radio" name="sisu-chart" checked={selected} onChange={onSelect} />
        <span className="hv-src-name">{row.source.label}</span>
      </label>
      {many ? (
        <button type="button" className="hv-link" onClick={onToggleAreas}>
          {row.badge}
        </button>
      ) : (
        <span className="hv-muted hv-badge">{row.badge}</span>
      )}
      {many && areasOpen ? (
        <div className="hv-areas">
          <button type="button" className={!file ? 'hv-area on' : 'hv-area'} onClick={onSelect}>
            All in this view
          </button>
          {row.overlap.map((f) => (
            <button
              key={f.file}
              type="button"
              className={file === f.file ? 'hv-area on' : 'hv-area'}
              onClick={() => onSelectFile(f.file)}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChartDetail({
  source,
  followingAuto,
  provider,
  harvest,
  activeJob,
  time,
  onTime,
  onReload,
}: {
  source: ChartSource | null;
  followingAuto: boolean;
  provider: Provider | null;
  harvest: ReturnType<typeof useViewHarvest>;
  activeJob: Job | null;
  time: string;
  onTime: (value: string) => void;
  onReload: () => void;
}) {
  if (!source) return null;
  const importedOnly = source.files.some((f) => f.imported) && !source.harvestId && !source.liveId;
  const liveOnly = Boolean(source.liveId) && !source.harvestId;
  return (
    <div className="hv-detail">
      <p className="hv-src-name">{followingAuto ? `On screen · ${source.label}` : source.label}</p>
      {activeJob ? (
        <p className="hv-muted">
          {source.label} · {activeJob.completed.toLocaleString()} / {activeJob.total.toLocaleString()} tiles
        </p>
      ) : null}
      {importedOnly ? <p className="hv-muted">On this boat · not a download</p> : null}
      {liveOnly && !source.files.length ? <p className="hv-muted">Live only · nothing is saved</p> : null}
      {provider?.stub ? <p className="hv-wait">Not downloadable yet</p> : null}
      {provider?.id === 'nasa-gibs' ? (
        <label className="hv-field">
          <span>Date (optional — most recent if blank)</span>
          <input type="date" value={time} onChange={(e) => onTime(e.target.value)} />
        </label>
      ) : null}
      {provider && harvest.estError ? <p className="hv-bad">{harvest.estError}</p> : null}
      {provider && harvest.outOfCoverage ? (
        <p className="hv-wait">{harvest.estimate?.coverageReason || 'Nothing in this view'}</p>
      ) : null}
      {provider && harvest.estimate && !harvest.outOfCoverage ? (
        <p className="hv-muted">
          {harvest.estimate.missing === 0
            ? 'This view is already saved'
            : harvest.estimate.missing != null
              ? `${harvest.estimate.missing.toLocaleString()} tiles still missing`
              : `~${harvest.estimate.tileCount.toLocaleString()} tiles`}
        </p>
      ) : null}
      {harvest.tooFar ? <p className="hv-wait">Zoom to z8 or closer before this fills on its own.</p> : null}
      {harvest.tooMany ? (
        <p className="hv-wait">This view is over 400 tiles, so filling waits until you zoom in.</p>
      ) : null}
      {harvest.overLimit ? <p className="hv-bad">Exceeds the export limit — zoom in.</p> : null}
      {harvest.quotaBlocked ? <p className="hv-bad">Disk quota reached.</p> : null}
      {provider?.access === 'secret' && provider.secretEnv && !provider.secretConfigured ? (
        <SecretField secretEnv={provider.secretEnv} configured={false} onChange={onReload} />
      ) : null}
      {provider && !provider.stub ? (
        <button type="button" disabled={!harvest.canStart} onClick={() => void harvest.start('manual')}>
          {harvest.starting ? 'Downloading…' : source.files.length ? 'Download the rest' : 'Download this view'}
        </button>
      ) : null}
      {provider && provider.autoHarvest !== false && !provider.stub ? (
        <label className="hv-auto">
          <input type="checkbox" checked={harvest.auto} onChange={(e) => harvest.setAuto(e.target.checked)} />
          Keep filling as I pan
        </label>
      ) : null}
      {harvest.startError ? <p className="hv-bad">{harvest.startError}</p> : null}
    </div>
  );
}

function GetSheet({
  items,
  unreadable,
  providers,
  onBack,
  onUse,
  onReload,
}: {
  items: { source: ChartSource; reason: string | null }[];
  unreadable: number;
  providers: Provider[];
  onBack: () => void;
  onUse: (id: string, liveId: LiveBasemapId | null) => void;
  onReload: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="hv-sheet">
      <button type="button" className="ghost" onClick={onBack}>
        Back to charts
      </button>
      <p className="hv-note">Charts you can add for this view. Opening one does not download it.</p>
      {unreadable ? <p className="hv-muted">coverage unreadable ({unreadable})</p> : null}
      {items.length === 0 ? <p className="hv-muted">Every downloadable chart for this view is already in the list.</p> : null}
      {items.map((item) => {
        const provider = providers.find((p) => p.id === item.source.harvestId) ?? null;
        const open = openId === item.source.id;
        return (
          <div key={item.source.id} className="hv-src">
            <button type="button" className="hv-src-main hv-plain" onClick={() => setOpenId(open ? null : item.source.id)}>
              <span>
                <span className="hv-src-name">{item.source.label}</span>
                <span className="hv-muted">{item.reason || 'nothing saved here'}</span>
              </span>
            </button>
            {open && provider ? (
              <GetChartBody
                provider={provider}
                stub={item.source.stub}
                onUse={() => onUse(item.source.id, item.source.liveId)}
                onReload={onReload}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function GetChartBody({
  provider,
  stub,
  onUse,
  onReload,
}: {
  provider: Provider;
  stub: boolean;
  onUse: () => void;
  onReload: () => void;
}) {
  const harvest = useViewHarvest(provider, '', false);
  return (
    <div className="hv-detail">
      {stub ? <p className="hv-wait">Not downloadable yet</p> : null}
      {harvest.estError ? <p className="hv-bad">{harvest.estError}</p> : null}
      {harvest.outOfCoverage ? (
        <p className="hv-wait">{harvest.estimate?.coverageReason || provider.outOfCoverageReason || 'Nothing in this view'}</p>
      ) : null}
      {harvest.estimate && !harvest.outOfCoverage && !stub ? (
        <p className="hv-muted">~{harvest.estimate.tileCount.toLocaleString()} tiles in this view</p>
      ) : null}
      {provider.access === 'secret' && provider.secretEnv && !provider.secretConfigured ? (
        <SecretField secretEnv={provider.secretEnv} configured={false} onChange={onReload} />
      ) : null}
      <div className="hv-row">
        <button type="button" className="ghost" onClick={onUse}>
          Use this chart
        </button>
        <button type="button" disabled={stub || !harvest.canStart} onClick={() => void harvest.start('manual')}>
          {harvest.starting ? 'Downloading…' : 'Download this view'}
        </button>
      </div>
      {harvest.startError ? <p className="hv-bad">{harvest.startError}</p> : null}
    </div>
  );
}

