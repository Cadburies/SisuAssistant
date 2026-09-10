import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { fmt, formatForecastTime } from '../../app/units';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { bindWavesClick, clearWaves, paintWaves, type CellPick } from './overlay';
import type { WaveForecast } from './types';
import './waves.css';

async function loadForecast(map: MapLibreMap): Promise<WaveForecast> {
  const b = map.getBounds();
  const qs = new URLSearchParams({
    west: String(b.getWest()),
    south: String(b.getSouth()),
    east: String(b.getEast()),
    north: String(b.getNorth()),
  });
  const res = await fetch(`/api/marine/forecast?${qs}`);
  const body = (await res.json().catch(() => ({}))) as WaveForecast & { error?: string };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function dirLabel(deg: number | null): string {
  return deg == null ? '—' : `${fmt(deg, 0)}°`;
}

function hsLabel(m: number | null): string {
  return m == null ? '—' : `${fmt(m, 1)} m`;
}

export function WavesPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [forecast, setForecast] = useState<WaveForecast | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [timeIndex, setTimeIndex] = useState(0);
  const [pick, setPick] = useState<CellPick | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setLayerTick] = useState(0);
  const on = isLayerOn('waves');
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
      clearWaves(map);
      return;
    }
    paintWaves(map, forecast, timeIndex);
    const onZoom = () => paintWaves(map, forecast, timeIndex);
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map, forecast, on, timeIndex]);

  useEffect(() => {
    if (!map) return;
    return bindWavesClick(map, setPick, () => stateRef.current);
  }, [map]);

  useEffect(() => {
    return () => {
      if (map) clearWaves(map);
    };
  }, [map]);

  const timeLabel = formatForecastTime(forecast?.times[timeIndex]);
  const modelLabel = forecast?.model.label ?? 'ECMWF WAM';
  const split = !!forecast?.hasComponents;

  return (
    <section className="waves">
      <div className="waves-head">
        <span>Waves / swell</span>
        {busy ? <span className="waves-muted">updating</span> : null}
      </div>
      <p className="waves-note">
        Internet marine forecast (not instrument). {modelLabel}, <code>cell_selection=sea</code>.
        WAM 0.25° is coarse vs island jets.
      </p>
      {!on ? <p className="waves-muted">Enable in Layers to draw Hs on the chart.</p> : null}
      {error ? <p className="waves-err">{error}</p> : null}
      <label className="waves-time">
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
      <div className="waves-legend" aria-label="Significant wave height">
        <span>0 m</span>
        <span className="waves-ramp" />
        <span>4 m+</span>
      </div>
      {split ? (
        <p className="waves-muted">Ticks: swell (cyan arrow) vs wind-sea (gold dot).</p>
      ) : (
        <p className="waves-muted">
          Combined sea — this model did not populate separate swell / wind-sea series.
        </p>
      )}
      {pick ? (
        <table className="waves-table">
          <caption>
            {pick.lat.toFixed(2)}° {pick.lon.toFixed(2)}°
          </caption>
          <tbody>
            <tr>
              <th>Hs</th>
              <td>{hsLabel(pick.sample.hs)}</td>
            </tr>
            <tr>
              <th>Dir</th>
              <td>{dirLabel(pick.sample.dir)}</td>
            </tr>
            {split ? (
              <>
                <tr>
                  <th>Swell</th>
                  <td>
                    {hsLabel(pick.sample.swellHs)} {dirLabel(pick.sample.swellDir)}
                  </td>
                </tr>
                <tr>
                  <th>Wind-sea</th>
                  <td>
                    {hsLabel(pick.sample.windSeaHs)} {dirLabel(pick.sample.windSeaDir)}
                  </td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
      ) : (
        <p className="waves-muted">Click a cell for Hs and direction.</p>
      )}
    </section>
  );
}
