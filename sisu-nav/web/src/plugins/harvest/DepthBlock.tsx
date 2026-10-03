import { useEffect, useMemo, useState } from 'react';
import { fetchBathyCoverage, type BathyCoverage } from './api';
import type { Provider } from './types';
import { SecretField } from './SecretField';
import { useViewHarvest } from './useViewHarvest';
import { isLayerOn, setLayerOn, subscribeLayers, type LayerId } from '../map/layers';
import { openLayersPanel } from '../layers/LayerPicker';
import {
  getDepthPicks,
  isDepthPinned,
  setDepthPick,
  setDepthPinned,
  subscribeDepth,
} from '../bathy/choice';
import { bathyLayerForProvider } from '../bathy/overlay';
import { rankDepth } from '../map/availability';
import type { ChartSource } from '../map/sources';
import type { Bbox } from '../map/geo';
import { listEnabledImports, setImportOn, subscribeImports } from '../imported/state';

const LAYER_LABEL: Record<string, string> = {
  'bathy-relief': 'Relief',
  'bathy-hillshade': 'Hillshade',
  'bathy-contours': 'Contours',
};

function slotLayer(source: ChartSource): LayerId {
  return bathyLayerForProvider(source.harvestId || source.id);
}

export function DepthBlock({
  sources,
  providers,
  view,
  onReloadProviders,
}: {
  sources: ChartSource[];
  providers: Provider[];
  view: { bbox: Bbox; zoom: number } | null;
  onReloadProviders: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState(getDepthPicks);
  const [pinned, setPinned] = useState(isDepthPinned);
  const [coverage, setCoverage] = useState<BathyCoverage | null>(null);
  const [importsOn, setImportsOn] = useState(listEnabledImports);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [, bump] = useState(0);
  useEffect(() => subscribeLayers(() => bump((n) => n + 1)), []);

  useEffect(() => subscribeDepth(() => {
    setPicks(getDepthPicks());
    setPinned(isDepthPinned());
  }), []);
  useEffect(() => subscribeImports(() => setImportsOn(listEnabledImports())), []);

  const depthKey = sources
    .filter((s) => s.role === 'depth')
    .map((s) => s.harvestId || s.id)
    .join('|');

  useEffect(() => {
    if (!view) return;
    const lat = (view.bbox[1] + view.bbox[3]) / 2;
    const lon = (view.bbox[0] + view.bbox[2]) / 2;
    let stop = false;
    const t = window.setTimeout(() => {
      fetchBathyCoverage(lat, lon, view.zoom)
        .then((cov) => {
          if (stop) return;
          setCoverage(cov);
          if (isDepthPinned()) return;
          const src = sources.find((s) => s.harvestId === cov.suggested || s.id === cov.suggested);
          if (!src?.overlay) return;
          setDepthPick(src.overlay, cov.suggested);
        })
        .catch(() => {});
    }, 500);
    return () => {
      stop = true;
      window.clearTimeout(t);
    };
  }, [view, depthKey]);

  const rows = useMemo(
    () => (view ? rankDepth(sources, view, coverage?.suggested ?? null) : []),
    [sources, view, coverage],
  );
  const activeId = coverage?.suggested && !pinned
    ? coverage.suggested
    : picks.relief || picks.hillshade || picks.contours;
  const active = rows.find((r) => r.source.harvestId === activeId || r.source.id === activeId) ?? rows[0];
  const provider = providers.find((p) => p.id === (active?.source.harvestId || ''));
  const harvest = useViewHarvest(provider ?? null);
  const layer = active ? slotLayer(active.source) : null;
  const layerOn = layer ? isLayerOn(layer) : false;
  const summary = active ? active.source.label : 'none here';

  return (
    <div className="hv-depth">
      <button type="button" className="hv-disclosure" onClick={() => { setOpen((v) => !v); bump((n) => n + 1); }}>
        <span>{open ? '▾' : '▸'} Depth</span>
        <span className="hv-muted">{summary} · {layer ? `${LAYER_LABEL[layer] || layer} ${layerOn ? 'on' : 'off'}` : 'off'}</span>
      </button>
      {open ? (
        <div className="hv-depth-body">
          <p className="hv-note">Not for navigation. Depth shading sits on the chart. On and off stays in Layers.</p>
          {coverage?.hint ? <p className="hv-muted">{coverage.hint}</p> : null}
          {rows.filter((r) => !r.source.files.some((f) => f.imported) || r.overlap.length).map((r) => {
            const id = r.source.harvestId || r.source.id;
            const selected = active?.source.id === r.source.id;
            const imported = r.source.files.some((f) => f.imported);
            return (
              <div key={r.source.id} className={r.dim ? 'hv-src dim' : 'hv-src'}>
                {imported ? (
                  <label className="hv-src-main">
                    <input
                      type="checkbox"
                      checked={r.overlap.some((f) => f.slug && importsOn.has(f.slug))}
                      onChange={(e) => {
                        for (const f of r.overlap) {
                          if (f.slug) setImportOn(f.slug, e.target.checked);
                        }
                      }}
                    />
                    <span>
                      <span className="hv-src-name">{r.source.label}</span>
                      <span className="hv-muted">{r.badge}</span>
                    </span>
                  </label>
                ) : (
                  <label className="hv-src-main">
                    <input
                      type="radio"
                      name="sisu-depth"
                      checked={selected}
                      onChange={() => {
                        if (r.source.overlay) setDepthPick(r.source.overlay, id);
                        setDepthPinned(true);
                      }}
                    />
                    <span>
                      <span className="hv-src-name">{r.source.label}</span>
                      <span className="hv-muted">
                        {LAYER_LABEL[slotLayer(r.source)] || ''} · {r.badge}
                        {coverage && coverage.suggested !== id && /bluetopo/i.test(id) && !coverage.bluetopo
                          ? ' · little data here'
                          : ''}
                      </span>
                    </span>
                  </label>
                )}
              </div>
            );
          })}
          <label className="hv-auto">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setDepthPinned(e.target.checked)}
            />
            Pin source
          </label>
          {provider?.access === 'secret' && provider.secretEnv ? (
            <button type="button" className="ghost" onClick={() => setShowKey(showKey === provider.id ? null : provider.id)}>
              {provider.secretConfigured ? 'Key saved' : 'Needs a key'}
            </button>
          ) : null}
          {showKey && provider?.secretEnv ? (
            <SecretField secretEnv={provider.secretEnv} configured={provider.secretConfigured} onChange={onReloadProviders} />
          ) : null}
          {harvest.estError ? <p className="hv-bad">{harvest.estError}</p> : null}
          {harvest.outOfCoverage ? <p className="hv-wait">{harvest.estimate?.coverageReason || 'Nothing in this view'}</p> : null}
          {provider && harvest.estimate ? (
            <p className="hv-muted">
              {harvest.estimate.missing === 0
                ? 'This view is already saved'
                : harvest.estimate.missing != null
                  ? `${harvest.estimate.missing.toLocaleString()} tiles still missing`
                  : `~${harvest.estimate.tileCount.toLocaleString()} tiles`}
            </p>
          ) : null}
          {provider ? (
            <button type="button" disabled={!harvest.canStart} onClick={() => void harvest.start('manual')}>
              {harvest.starting ? 'Downloading…' : 'Download this view'}
            </button>
          ) : null}
          {provider && provider.autoHarvest !== false && !provider.stub ? (
            <label className="hv-auto">
              <input type="checkbox" checked={harvest.auto} onChange={(e) => harvest.setAuto(e.target.checked)} />
              Keep filling as I pan
            </label>
          ) : null}
          {harvest.startError ? <p className="hv-bad">{harvest.startError}</p> : null}
          {layer && !layerOn ? (
            <button type="button" className="ghost" onClick={() => setLayerOn(layer, true)}>
              Show {LAYER_LABEL[layer] || 'depth'}
            </button>
          ) : null}
          <button type="button" className="ghost" onClick={() => openLayersPanel()}>
            Layers
          </button>
        </div>
      ) : null}
    </div>
  );
}
