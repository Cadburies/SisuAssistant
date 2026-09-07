import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { fmt } from '../../app/units';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { fetchRoses, type RoseQuery } from './api';
import { bindRoseClick, clearRoses, paintRoses } from './overlay';
import type { RoseCell, RosesPayload } from './types';
import './roses.css';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function RosePanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setTick] = useState(0);
  const [kind, setKind] = useState<RoseQuery['kind']>('days');
  const [n, setN] = useState(30);
  const [month, setMonth] = useState(new Date().getUTCMonth() + 1);
  const [data, setData] = useState<RosesPayload | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const on = isLayerOn('roses');

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setTick((x) => x + 1)), []);

  useEffect(() => {
    if (!on) {
      if (map) clearRoses(map);
      return;
    }
    let cancelled = false;
    const q: RoseQuery =
      kind === 'monthOfYear' ? { kind, month } : { kind, n };
    setBusy(true);
    fetchRoses(q)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setError(undefined);
        setPick(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [on, kind, n, month, map]);

  useEffect(() => {
    if (!map || !data || !on) return;
    paintRoses(map, data.cells, data.spec.bins);
  }, [map, data, on]);

  useEffect(() => {
    if (!map) return;
    return bindRoseClick(map, setPick);
  }, [map]);

  useEffect(() => {
    return () => {
      if (map) clearRoses(map);
    };
  }, [map]);

  const cell: RoseCell | undefined = pick
    ? data?.cells.find((c) => c.geohash === pick)
    : undefined;

  return (
    <section className="rs">
      <div className="rs-head">
        <span>Wind roses</span>
        {busy ? <span className="rs-muted">loading</span> : null}
      </div>
      <p className="rs-note">
        This boat’s measured TWD + AWS (Grafana WeatherTWD spec). Not a forecast. Enable in Layers.
      </p>
      <label className="rs-field">
        Window
        <select
          value={kind}
          onChange={(e) => {
            const next = e.target.value as RoseQuery['kind'];
            setKind(next);
            if (next === 'days') setN(30);
            else if (next === 'months') setN(1);
          }}
          disabled={!on}
        >
          <option value="days">Last days</option>
          <option value="months">Last months</option>
          <option value="monthOfYear">Month of year</option>
        </select>
      </label>
      {kind === 'monthOfYear' ? (
        <label className="rs-field">
          Month
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} disabled={!on}>
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="rs-field">
          {kind === 'days' ? 'Days' : 'Months'}
          <select value={n} onChange={(e) => setN(Number(e.target.value))} disabled={!on}>
            {(kind === 'days' ? [1, 7, 30] : [1, 3, 12]).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      {!on ? <p className="rs-muted">Layer off — turn on Wind roses in Layers.</p> : null}
      {error ? <p className="rs-err">{error}</p> : null}
      {on && data ? (
        <p className="rs-muted">
          {data.cellCount} cells · {data.joined} samples · {data.bucket}
          {data.joined === 0 ? ' — no TWD/AWS in this window (Sisu_1m).' : ''}
        </p>
      ) : null}
      {data?.spec.bins ? (
        <div className="rs-legend" aria-label="kn bands">
          {data.spec.bins.map((b) => (
            <span key={b.id}>
              <i style={{ background: b.color }} />
              {b.name}
            </span>
          ))}
        </div>
      ) : null}
      {cell ? (
        <table className="rs-table">
          <caption>
            {cell.lat.toFixed(2)}° {cell.lon.toFixed(2)}° · n={cell.n} · calm {fmt(cell.calmPct, 1)}%
          </caption>
          <thead>
            <tr>
              <th>Dir</th>
              {data?.spec.bins.map((b) => (
                <th key={b.id}>{b.name.split(' ')[0]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cell.petals
              .filter((p) => p.total > 0)
              .sort((a, b) => b.total - a.total)
              .slice(0, 8)
              .map((p) => (
                <tr key={p.deg}>
                  <td>{p.deg}°</td>
                  {data?.spec.bins.map((b) => (
                    <td key={b.id}>{fmt(p.bands[b.id], 1)}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p className="rs-muted">Click a rose for per-band %.</p>
      )}
    </section>
  );
}
