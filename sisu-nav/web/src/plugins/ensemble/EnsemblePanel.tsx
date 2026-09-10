import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { bindEnsembleClick, clearEnsemble, paintEnsemble, type CellPick } from './overlay';
import type { EnsembleForecast } from './types';
import { fmt, formatForecastTime } from '../../app/units';
import './ensemble.css';

async function loadForecast(map: MapLibreMap, deep: boolean): Promise<EnsembleForecast> {
  const b = map.getBounds();
  const qs = new URLSearchParams({
    west: String(b.getWest()),
    south: String(b.getSouth()),
    east: String(b.getEast()),
    north: String(b.getNorth()),
    deep: deep ? '1' : '0',
  });
  const res = await fetch(`/api/ensemble/forecast?${qs}`);
  const body = (await res.json().catch(() => ({}))) as EnsembleForecast & { error?: string };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export function EnsemblePanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [forecast, setForecast] = useState<EnsembleForecast | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [deep, setDeep] = useState(false);
  const [timeIndex, setTimeIndex] = useState(0);
  const [pick, setPick] = useState<CellPick | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setLayerTick] = useState(0);
  const on = isLayerOn('ens-ecmwf');
  const stateRef = useRef({ forecast, selected: [] as string[], timeIndex });

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);

  useEffect(() => {
    if (!map || !on) return;
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      try {
        const data = await loadForecast(map, deep);
        if (cancelled) return;
        setForecast(data);
        setError(undefined);
        setTimeIndex((i) => Math.min(i, Math.max(0, data.times.length - 1)));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void run();
    let t = 0;
    const onMove = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => void run(), 400);
    };
    map.on('moveend', onMove);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      map.off('moveend', onMove);
    };
  }, [map, on, deep]);

  const selected = forecast?.models.map((m) => m.id) ?? [];
  stateRef.current = { forecast, selected, timeIndex };

  useEffect(() => {
    if (!map) return;
    if (!on || !forecast) {
      clearEnsemble(map);
      return;
    }
    paintEnsemble(map, forecast, selected, timeIndex);
    const onZoom = () => paintEnsemble(map, forecast, selected, timeIndex);
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
    // selected is derived from forecast.models; listing it retriggers every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, forecast, on, timeIndex]);

  useEffect(() => {
    if (!map) return;
    return bindEnsembleClick(map, setPick, () => stateRef.current);
  }, [map]);

  useEffect(() => {
    return () => {
      if (map) clearEnsemble(map);
    };
  }, [map]);

  if (!on) {
    return (
      <section className="ens">
        <div className="ens-head">
          <span>Ensemble wind</span>
        </div>
        <p className="ens-muted">Enable &quot;Ensemble wind (ECMWF IFS)&quot; in Layers to show member spaghetti.</p>
      </section>
    );
  }

  const timeLabel = formatForecastTime(forecast?.times[timeIndex]);
  const models = forecast?.models ?? [];

  return (
    <section className="ens">
      <div className="ens-head">
        <span>Ensemble wind (ECMWF IFS)</span>
        {busy ? <span className="ens-muted">updating</span> : null}
      </div>
      <p className="ens-note">
        Internet forecast (tier 4), {forecast?.deep ? 'full 51 members' : `clustered ${models.length} of 51`} — not a
        twin of instrument TWD/TWS.
      </p>
      {error ? <p className="ens-err">{error}</p> : null}
      <label className="ens-deep">
        <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} />
        Deep (all 51 members — heavier fetch)
      </label>
      <label className="ens-time">
        <span>{timeLabel}</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, (forecast?.times.length ?? 1) - 1)}
          value={timeIndex}
          onChange={(e) => setTimeIndex(Number(e.target.value))}
        />
      </label>
      <div className="ens-legend">
        <i className="ens-swatch ens-swatch-control" />
        <span>control</span>
        <span className="ens-ramp" />
        <span>members</span>
      </div>
      {pick ? (
        <div className="ens-table-wrap">
          <table className="ens-table">
            <caption>
              {pick.lat.toFixed(2)}° {pick.lon.toFixed(2)}°
            </caption>
            <thead>
              <tr>
                <th>Member</th>
                <th>TWD</th>
                <th>TWS</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const s = pick.samples[m.id];
                return (
                  <tr key={m.id}>
                    <td>
                      <i style={{ background: m.color }} /> {m.label}
                    </td>
                    <td>{s ? `${fmt(s.twd, 0)}°` : '—'}</td>
                    <td>{s ? `${fmt(s.tws, 1)} kn` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="ens-muted">Click a line for per-member TWD/TWS at that cell.</p>
      )}
    </section>
  );
}
