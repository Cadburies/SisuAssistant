import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { fmt } from '../../app/units';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import {
  boatId,
  fetchAnchorSpots,
  fetchCommunityRoses,
  fetchRoses,
  setAnchorBerths,
  setAnchorCommunity,
  shareRoses,
  type RoseQuery,
} from './api';
import { bindRoseClick, clearRoses, paintRoses } from './overlay';
import type { AnchorSpot, AnchorSpotsPayload, RoseCell, RosesPayload } from './types';
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

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 60) return `${min} min ago`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function steadyLabel(r: number | null): string {
  if (r == null) return '—';
  if (r >= 0.85) return `${r.toFixed(2)} steady`;
  if (r >= 0.6) return `${r.toFixed(2)} shifty`;
  return `${r.toFixed(2)} all over the place`;
}

/** Share of windy samples on bow / starboard / stern / port (±45° quarters). */
function windOnBoat(spot: AnchorSpot): { bow: number; stbd: number; stern: number; port: number } | null {
  const bow = spot.headingDeg;
  if (bow == null) return null;
  const q = { bow: 0, stbd: 0, stern: 0, port: 0 };
  let total = 0;
  for (const p of spot.petals) {
    const rel: number = (((p.deg - bow) % 360) + 360) % 360;
    const k: keyof typeof q = rel < 45 || rel >= 315 ? 'bow' : rel < 135 ? 'stbd' : rel < 225 ? 'stern' : 'port';
    q[k] += p.total;
    total += p.total;
  }
  if (total <= 0) return null;
  return { bow: (100 * q.bow) / total, stbd: (100 * q.stbd) / total, stern: (100 * q.stern) / total, port: (100 * q.port) / total };
}

function anchorPayload(a: AnchorSpotsPayload): RosesPayload {
  return {
    window: { kind: 'anchor' },
    bucket: 'anchor spots',
    pairing: { direction: 'sensor.nmea_twd', speed: 'sensor.nmea_aws' },
    spec: { ...a.spec, geohash: 8 },
    joined: a.spots.reduce((s, x) => s + x.n, 0),
    skippedNoPos: 0,
    raw: { twd: 0, aws: 0 },
    cellCount: a.spots.length,
    // Spot id doubles as the pick key the overlay hands back.
    cells: a.spots
      .filter((x) => x.n > 0)
      .map((x) => ({ ...x, geohash: x.id, bowDeg: x.kind === 'berth' ? x.headingDeg : null })),
  };
}

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
  const [source, setSource] = useState<'boat' | 'anchor' | 'community'>('boat');
  const [anchor, setAnchor] = useState<AnchorSpotsPayload | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [share, setShare] = useState(() => {
    try {
      return localStorage.getItem('sisu-nav.roses-share') === '1';
    } catch {
      return false;
    }
  });
  const on = isLayerOn('roses');

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => {
    if (anchor && anchor.status.communityOptIn !== share) void setAnchorCommunity(share).catch(() => undefined);
  }, [anchor, share]);
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
    const load =
      source === 'anchor'
        ? fetchAnchorSpots(refresh > 0).then((a) => {
            setAnchor(a);
            return anchorPayload(a);
          })
        : source === 'community' && map
        ? fetchCommunityRoses({
            west: map.getBounds().getWest(),
            south: map.getBounds().getSouth(),
            east: map.getBounds().getEast(),
            north: map.getBounds().getNorth(),
            month: kind === 'monthOfYear' ? month : 0,
          }).then((c) => ({
            cellCount: c.cells.length,
            cells: c.cells,
            joined: c.cells.reduce((s, x) => s + x.n, 0),
            skippedNoPos: 0,
            raw: { twd: 0, aws: 0 },
            bucket: c.configured ? 'community' : 'community-unconfigured',
            window: q,
            pairing: { direction: 'sensor.nmea_twd', speed: 'sensor.nmea_aws' },
            spec: c.spec || { bins: [], petals: 36, calmMax: 2, geohash: 5 },
          }) as RosesPayload)
        : fetchRoses(q);
    load
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
  }, [on, kind, n, month, map, source, refresh]);

  useEffect(() => {
    if (!map || !data || !on) return;
    paintRoses(map, data.cells, data.spec.bins, data.window.kind === 'anchor');
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
  const spot: AnchorSpot | undefined =
    source === 'anchor' && pick ? anchor?.spots.find((x) => x.id === pick) : undefined;
  const goTo = (x: AnchorSpot) => {
    setPick(x.id);
    map?.flyTo({ center: [x.lon, x.lat], zoom: Math.max(map.getZoom(), 15) });
  };

  return (
    <section className="rs">
      <div className="rs-head">
        <span>Wind roses</span>
        {busy ? <span className="rs-muted">loading</span> : null}
      </div>
      <p className="rs-note">
        This boat’s measured TWD + AWS (Grafana WeatherTWD spec). Not a forecast. Enable in Layers.
      </p>
      <div className="rs-field">
        Source
        <div className="rs-row">
          <button type="button" className={source === 'boat' ? 'on' : ''} onClick={() => setSource('boat')}>
            This boat
          </button>
          <button type="button" className={source === 'anchor' ? 'on' : ''} onClick={() => setSource('anchor')}>
            Anchor spots
          </button>
          <button type="button" className={source === 'community' ? 'on' : ''} onClick={() => setSource('community')}>
            Community
          </button>
        </div>
      </div>
      {source === 'anchor' ? (
        <>
          <p className="rs-note">
            Built automatically each time Sisu anchors (engines off, bow swinging into the wind, or anchor alarm armed). One rose per
            spot; spots within {anchor?.status.mergeM ?? 100} m merge. Zoom into a bay to tell spots apart.
          </p>
          {anchor ? (
            <p className="rs-muted">
              Detected {ago(anchor.status.lastRunAt)} (every {anchor.status.everyMin} min) · SisuMate sync{' '}
              {anchor.status.syncConfigured
                ? `${anchor.status.signedIn?.boat ? `as ${anchor.status.signedIn.boat} ` : ''}${ago(anchor.status.lastSyncAt)}${anchor.status.pendingHours ? ` · ${anchor.status.pendingHours} h pending` : ''}`
                : 'off — local only'}
              {anchor.status.lastSyncError ? ` · ${anchor.status.lastSyncError}` : ''}
              {anchor.status.communityOptIn
                ? ` · community ${anchor.status.communityError ? anchor.status.communityError : ago(anchor.status.communityAt)}`
                : ''}
            </p>
          ) : null}
          <div className="rs-row">
            <button type="button" disabled={!on || busy} onClick={() => setRefresh((x) => x + 1)}>
              Detect now
            </button>
          </div>
          <label className="rs-auto">
            <input
              type="checkbox"
              checked={Boolean(anchor?.status.berths)}
              disabled={!anchor}
              onChange={(e) => {
                void setAnchorBerths(e.target.checked)
                  .then(() => setRefresh((x) => x + 1))
                  .catch((err) => setError(err instanceof Error ? err.message : String(err)));
              }}
            />
            Include marinas &amp; slips (how the wind lies on the boat at the dock; never shared to community)
          </label>
          {anchor?.spots.length ? (
            <ul className="rs-spots">
              {anchor.spots.map((x) => (
                <li key={x.id}>
                  <button type="button" className={pick === x.id ? 'on' : ''} onClick={() => goTo(x)}>
                    {x.kind === 'berth' ? 'Slip' : 'Anchor'} · {x.lat.toFixed(4)}° {x.lon.toFixed(4)}° ·{' '}
                    {fmt(x.minutes / 60, 0)} h · {ago(x.lastSeen)}
                  </button>
                </li>
              ))}
            </ul>
          ) : on && anchor ? (
            <p className="rs-muted">No anchor spots yet — they appear after the first anchoring with wind data.</p>
          ) : null}
        </>
      ) : null}
      <label className="rs-auto">
        <input
          type="checkbox"
          checked={share}
          onChange={(e) => {
            const next = e.target.checked;
            setShare(next);
            try {
              localStorage.setItem('sisu-nav.roses-share', next ? '1' : '0');
            } catch {
              /* quota */
            }
            void setAnchorCommunity(next).catch((err) => setError(err instanceof Error ? err.message : String(err)));
            if (next && data?.cells?.length && source !== 'anchor') {
              void shareRoses({
                boatId: boatId(),
                month: kind === 'monthOfYear' ? month : 0,
                cells: data.cells,
              }).catch((err) => setError(err instanceof Error ? err.message : String(err)));
            }
          }}
        />
        Share my roses (opt-in, aggregated only — incl. anchor spots; shown to others once ≥3 boats share a spot)
      </label>
      {source !== 'anchor' ? (
      <>
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
      </>
      ) : null}
      {!on ? <p className="rs-muted">Layer off — turn on Wind roses in Layers.</p> : null}
      {error ? <p className="rs-err">{error}</p> : null}
      {on && data && source !== 'anchor' ? (
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
            {spot ? (
              <>
                {spot.lat.toFixed(5)}° {spot.lon.toFixed(5)}° · {fmt(spot.minutes / 60, 0)} h over {spot.visits}{' '}
                {spot.visits === 1 ? 'visit' : 'visits'} · last {ago(spot.lastSeen)}
                <br />
                {spot.kind === 'berth' ? (
                  <>
                    Slip · bow {spot.headingDeg ?? '—'}°
                    {(() => {
                      const w = windOnBoat(spot);
                      return w
                        ? ` · wind on bow ${fmt(w.bow, 0)}% · stbd ${fmt(w.stbd, 0)}% · stern ${fmt(w.stern, 0)}% · port ${fmt(w.port, 0)}%`
                        : '';
                    })()}
                    <br />
                    Wind {steadyLabel(spot.steadiness)} · max {fmt(spot.maxKn, 0)} kn · calm {fmt(spot.calmPct, 1)}% · n=
                    {spot.n}
                  </>
                ) : (
                  <>
                    Wind {steadyLabel(spot.steadiness)} · swing ~{spot.swingM} m · max {fmt(spot.maxKn, 0)} kn · calm{' '}
                    {fmt(spot.calmPct, 1)}% · n={spot.n}
                  </>
                )}
              </>
            ) : (
              <>
                {cell.lat.toFixed(2)}° {cell.lon.toFixed(2)}° · n={cell.n} · calm {fmt(cell.calmPct, 1)}%
              </>
            )}
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
