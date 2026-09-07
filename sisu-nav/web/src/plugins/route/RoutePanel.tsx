import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { fmt } from '../../app/units';
import { subscribeNavMap } from '../map/registry';
import { commitRoute, planRoute } from './api';
import { clearRoute, paintRoute } from './overlay';
import type { LatLon, PlanResult, RouteMode } from './types';
import './route.css';

const BVI_START: LatLon = { lat: 18.405, lon: -64.575 };
const BVI_DEST: LatLon = { lat: 18.51, lon: -64.35 };

const MODES: Array<{ id: RouteMode; label: string }> = [
  { id: 'eta', label: 'Minimize ETA' },
  { id: 'modelAgreement', label: 'Prefer multi-model agreement' },
  { id: 'ensembleAgreement', label: 'Prefer ensemble-member agreement' },
];

export function RoutePanel({ sk }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [mode, setMode] = useState<RouteMode>('eta');
  const [deep, setDeep] = useState(false);
  const [maxTws, setMaxTws] = useState(30);
  const [maxHs, setMaxHs] = useState(3);
  const [dest, setDest] = useState<LatLon | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [commitMsg, setCommitMsg] = useState<string | undefined>();

  const start: LatLon =
    sk.self.lat != null && sk.self.lon != null
      ? { lat: sk.self.lat, lon: sk.self.lon }
      : BVI_START;

  useEffect(() => subscribeNavMap(setMap), []);

  useEffect(() => {
    if (!map) return;
    if (plan?.corridor) paintRoute(map, plan.corridor);
  }, [map, plan]);

  useEffect(() => {
    return () => {
      if (map) clearRoute(map);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !picking) return;
    const onClick = (e: { lngLat: { lat: number; lng: number } }) => {
      setDest({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      setPicking(false);
    };
    map.getCanvas().style.cursor = 'crosshair';
    map.on('click', onClick);
    return () => {
      map.getCanvas().style.cursor = '';
      map.off('click', onClick);
    };
  }, [map, picking]);

  async function compute(nextDest = dest, nextStart = start) {
    if (!nextDest) {
      setError('Pick a destination on the map, or use the BVI test hop.');
      return;
    }
    setBusy(true);
    setError(undefined);
    setCommitMsg(undefined);
    try {
      const data = await planRoute({
        start: nextStart,
        dest: nextDest,
        mode,
        deep,
        maxTws,
        maxHs,
      });
      setPlan(data);
      if (map) {
        paintRoute(map, data.corridor);
        const coords = data.route.coordinates;
        if (coords.length >= 2) {
          const b = coords.reduce(
            (acc, [lon, lat]) => ({
              w: Math.min(acc.w, lon),
              s: Math.min(acc.s, lat),
              e: Math.max(acc.e, lon),
              n: Math.max(acc.n, lat),
            }),
            { w: 180, s: 90, e: -180, n: -90 },
          );
          map.fitBounds(
            [
              [b.w, b.s],
              [b.e, b.n],
            ],
            { padding: 48, maxZoom: 11, duration: 600 },
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCommit() {
    if (!plan) return;
    setBusy(true);
    setError(undefined);
    try {
      const saved = await commitRoute({
        name: `Sisu Nav ${mode} ${new Date().toISOString().slice(0, 10)}`,
        coordinates: plan.route.coordinates,
        distanceNm: plan.distanceNm,
        mode: plan.mode,
        polar: plan.polar.id,
      });
      setCommitMsg(`Wrote ${saved.id.slice(0, 8)}… via ${saved.via}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const histMax = Math.max(1, ...(plan?.etaHistogram.map((b) => b.count) || [1]));

  return (
    <section className="rt">
      <div className="rt-head">
        <span>Route</span>
        {busy ? <span className="rt-muted">computing</span> : null}
      </div>
      <p className="rt-note">Advisory only — not coupled to autopilot. PredictWind stays the offshore backup.</p>
      <div className="rt-modes" role="radiogroup" aria-label="Router mode">
        {MODES.map((m) => (
          <label key={m.id} className="rt-mode">
            <input
              type="radio"
              name="sisu-route-mode"
              checked={mode === m.id}
              onChange={() => setMode(m.id)}
            />
            {m.label}
          </label>
        ))}
      </div>
      <label className="rt-check">
        <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} />
        Deep ensemble (full GEFS + ECMWF ENS)
      </label>
      <div className="rt-row">
        <label className="rt-field">
          Max TWS kn
          <input
            type="number"
            min={8}
            max={50}
            value={maxTws}
            onChange={(e) => setMaxTws(Number(e.target.value))}
          />
        </label>
        <label className="rt-field">
          Max Hs m
          <input
            type="number"
            min={0.5}
            max={8}
            step={0.5}
            value={maxHs}
            onChange={(e) => setMaxHs(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="rt-actions">
        <button type="button" className={picking ? 'active' : ''} onClick={() => setPicking(true)}>
          {picking ? 'Click map…' : 'Pick dest'}
        </button>
        <button
          type="button"
          onClick={() => {
            setDest(BVI_DEST);
            void compute(BVI_DEST, BVI_START);
          }}
        >
          BVI test hop
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => void compute()}>
          Compute
        </button>
      </div>
      <p className="rt-muted">
        {dest
          ? `Dest ${dest.lat.toFixed(3)}° ${dest.lon.toFixed(3)}°`
          : 'No destination yet.'}{' '}
        Start {start.lat.toFixed(3)}° {start.lon.toFixed(3)}°
      </p>
      {error ? <p className="rt-err">{error}</p> : null}
      {plan ? (
        <>
          <p className="rt-warn">{plan.polarWarning}</p>
          <div className="rt-stats">
            <div>
              <span>ETA</span> {fmt(plan.etaHours, 1)} h
            </div>
            <div>
              <span>Dist</span> {fmt(plan.distanceNm, 1)} nm
            </div>
            <div>
              <span>P90 TWS</span> {fmt(plan.p90Tws ?? undefined, 1)} kn
            </div>
            <div>
              <span>Members</span> {plan.membersUsed.length}
              {plan.deep ? ' deep' : ' clustered'}
            </div>
          </div>
          {plan.etaHistogram.length ? (
            <div className="rt-hist" aria-label="ETA histogram">
              {plan.etaHistogram.map((b) => (
                <i
                  key={b.hours}
                  title={`${b.hours.toFixed(1)} h × ${b.count}`}
                  style={{ height: `${Math.max(8, (100 * b.count) / histMax)}%` }}
                />
              ))}
            </div>
          ) : null}
          <p className="rt-muted">
            {plan.arrived ? 'Corridor reached dest.' : 'Partial corridor — did not close on dest.'} Land{' '}
            {plan.land.source}
            {plan.land.weatherRouting?.installed ? ' + SK weather-routing' : ' (GSHHG)'}.{' '}
            {plan.cellSelection === 'sea' ? 'Ensemble cell_selection=sea.' : null}
          </p>
          <div className="rt-actions">
            <button type="button" className="primary" disabled={busy} onClick={() => void onCommit()}>
              Commit to Signal K
            </button>
          </div>
          {commitMsg ? <p className="rt-ok">{commitMsg}</p> : null}
        </>
      ) : null}
    </section>
  );
}
