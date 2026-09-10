import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { fmt, formatForecastTime } from '../../app/units';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { bindCurrentsClick, clearCurrents, paintCurrents, type CellPick } from './overlay';
import type { CurrentForecast } from './types';
import './currents.css';

async function loadForecast(map: MapLibreMap): Promise<CurrentForecast> {
  const b = map.getBounds();
  const qs = new URLSearchParams({
    west: String(b.getWest()),
    south: String(b.getSouth()),
    east: String(b.getEast()),
    north: String(b.getNorth()),
  });
  const res = await fetch(`/api/marine/currents?${qs}`);
  const body = (await res.json().catch(() => ({}))) as CurrentForecast & { error?: string };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function dirLabel(deg: number | null): string {
  return deg == null ? '—' : `${fmt(deg, 0)}°`;
}

function knLabel(kn: number | null): string {
  return kn == null ? '—' : `${fmt(kn, 1)} kn`;
}

export function CurrentsPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [forecast, setForecast] = useState<CurrentForecast | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [timeIndex, setTimeIndex] = useState(0);
  const [pick, setPick] = useState<CellPick | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setLayerTick] = useState(0);
  const on = isLayerOn('currents');
  const stateRef = useRef({ forecast, timeIndex });
  stateRef.current = { forecast, timeIndex };

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);

  useEffect(() => {
    if (!map || !on) return;
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      try {
        const data = await loadForecast(map);
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
  }, [map, on]);

  useEffect(() => {
    if (!map) return;
    if (!on || !forecast) {
      clearCurrents(map);
      return;
    }
    paintCurrents(map, forecast, timeIndex);
    const onZoom = () => paintCurrents(map, forecast, timeIndex);
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map, forecast, on, timeIndex]);

  useEffect(() => {
    if (!map) return;
    return bindCurrentsClick(map, setPick, () => stateRef.current);
  }, [map]);

  useEffect(() => {
    return () => {
      if (map) clearCurrents(map);
    };
  }, [map]);

  const timeLabel = formatForecastTime(forecast?.times[timeIndex]);
  const modelLabel = forecast?.model.label ?? 'Meteo-France SMOC';
  const sea = forecast?.seaCount ?? 0;

  return (
    <section className="currents">
      <div className="currents-head">
        <span>Currents</span>
        {busy ? <span className="currents-muted">updating</span> : null}
      </div>
      <p className="currents-note">
        Internet marine forecast (not instrument). {modelLabel}, <code>cell_selection=sea</code>.
        Arrows point <em>towards</em> (flow direction). ~8 km grid is coarse vs island jets.
      </p>
      {!on ? <p className="currents-muted">Enable in Layers to draw current arrows on the chart.</p> : null}
      {error ? <p className="currents-err">{error}</p> : null}
      <label className="currents-time">
        <span>{timeLabel}</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, (forecast?.times.length ?? 1) - 1)}
          value={timeIndex}
          onChange={(e) => setTimeIndex(Number(e.target.value))}
          disabled={!forecast}
        />
      </label>
      <div className="currents-legend" aria-label="Current speed">
        <span>0 kn</span>
        <span className="currents-ramp" />
        <span>4 kn+</span>
      </div>
      {on && forecast ? (
        <p className="currents-muted">
          {sea} sea cell{sea === 1 ? '' : 's'} this view.
        </p>
      ) : null}
      {pick ? (
        <table className="currents-table">
          <caption>
            {pick.lat.toFixed(2)}° {pick.lon.toFixed(2)}°
          </caption>
          <tbody>
            <tr>
              <th>Speed</th>
              <td>{knLabel(pick.sample.velocityKn)}</td>
            </tr>
            <tr>
              <th>Towards</th>
              <td>{dirLabel(pick.sample.dir)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="currents-muted">Click an arrow for speed and direction.</p>
      )}
    </section>
  );
}
