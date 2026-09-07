import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { subscribeNavMap } from '../map/registry';
import {
  bindHeatClick,
  clearForecast,
  paintForecast,
  type CellPick,
} from './overlay';
import { startParticles } from './particles';
import type { Forecast } from './types';
import { fmt } from '../../app/units';
import './weather.css';

const DEFAULT_SELECTED = ['gfs_seamless', 'ecmwf_ifs025'];

async function loadForecast(map: MapLibreMap): Promise<Forecast> {
  const b = map.getBounds();
  const qs = new URLSearchParams({
    west: String(b.getWest()),
    south: String(b.getSouth()),
    east: String(b.getEast()),
    north: String(b.getNorth()),
  });
  const res = await fetch(`/api/weather/forecast?${qs}`);
  if (!res.ok) throw new Error(`forecast ${res.status}`);
  return (await res.json()) as Forecast;
}

export function WeatherPanel({ sk }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTED);
  const [timeIndex, setTimeIndex] = useState(0);
  const [particleModel, setParticleModel] = useState('');
  const [pick, setPick] = useState<CellPick | null>(null);
  const [busy, setBusy] = useState(false);
  const small = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
  const stateRef = useRef({ forecast, selected, timeIndex, particleModel });
  stateRef.current = { forecast, selected, timeIndex, particleModel };

  useEffect(() => subscribeNavMap(setMap), []);

  useEffect(() => {
    if (!map) return;
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
  }, [map]);

  useEffect(() => {
    if (!map || !forecast) return;
    paintForecast(map, forecast, selected, timeIndex);
    const onZoom = () => paintForecast(map, forecast, selected, timeIndex);
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map, forecast, selected, timeIndex]);

  useEffect(() => {
    if (!map) return;
    return bindHeatClick(map, setPick, () => stateRef.current);
  }, [map]);

  useEffect(() => {
    if (!map) return;
    if (small) return;
    return startParticles(map, () => ({
      forecast: stateRef.current.forecast,
      timeIndex: stateRef.current.timeIndex,
      modelId: stateRef.current.particleModel,
    }));
  }, [map, small]);

  useEffect(() => {
    return () => {
      if (map) clearForecast(map);
    };
  }, [map]);

  const models = forecast?.models ?? [];
  const timeLabel = forecast?.times[timeIndex]?.replace('T', ' ').slice(0, 16) ?? '—';
  const boatHint = useMemo(() => {
    if (sk.self.lat == null) return 'Instrument wind stays on the windex.';
    return 'Internet forecast (tier 4) — not a twin of instrument TWD/TWS.';
  }, [sk.self.lat]);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return next.length ? next : cur;
    });
  }

  return (
    <section className="wx">
      <div className="wx-head">
        <span>Forecast overlay</span>
        {busy ? <span className="wx-muted">updating</span> : null}
      </div>
      <p className="wx-note">{boatHint}</p>
      {error ? <p className="wx-err">{error}</p> : null}
      <div className="wx-models">
        {models.map((m) => (
          <label key={m.id} className="wx-model">
            <input
              type="checkbox"
              checked={selected.includes(m.id)}
              onChange={() => toggle(m.id)}
            />
            <i style={{ background: m.color }} />
            {m.label}
          </label>
        ))}
      </div>
      <label className="wx-time">
        <span>{timeLabel} UTC</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, (forecast?.times.length ?? 1) - 1)}
          value={timeIndex}
          onChange={(e) => setTimeIndex(Number(e.target.value))}
        />
      </label>
      <label className="wx-particles">
        Particles
        <select
          value={small ? '' : particleModel}
          disabled={small}
          onChange={(e) => setParticleModel(e.target.value)}
        >
          <option value="">Off</option>
          {models
            .filter((m) => selected.includes(m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
        </select>
        {small ? <span className="wx-muted">off on small screens</span> : null}
      </label>
      <div className="wx-legend" aria-label="Agreement">
        <span>agree</span>
        <span className="wx-ramp" />
        <span>diverge</span>
      </div>
      {pick ? (
        <table className="wx-table">
          <caption>
            {pick.lat.toFixed(2)}° {pick.lon.toFixed(2)}°
          </caption>
          <thead>
            <tr>
              <th>Model</th>
              <th>TWD</th>
              <th>TWS</th>
            </tr>
          </thead>
          <tbody>
            {selected.map((id) => {
              const m = models.find((x) => x.id === id);
              const s = pick.samples[id];
              return (
                <tr key={id}>
                  <td>
                    <i style={{ background: m?.color }} /> {m?.label ?? id}
                  </td>
                  <td>{s ? `${fmt(s.twd, 0)}°` : '—'}</td>
                  <td>{s ? `${fmt(s.tws, 1)} kn` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="wx-muted">Click a cell for per-model TWD/TWS.</p>
      )}
    </section>
  );
}
