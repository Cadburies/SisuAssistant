import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { bindHazardsClick, clearHazards, paintHazards } from './overlay';
import type { HazardsResponse } from './types';
import './hazards.css';

async function loadHazards(): Promise<HazardsResponse> {
  const res = await fetch('/api/hazards/cables');
  const body = (await res.json().catch(() => ({}))) as Partial<HazardsResponse>;
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body as HazardsResponse;
}

export function HazardsPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setLayerTick] = useState(0);
  const [data, setData] = useState<HazardsResponse | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const on = isLayerOn('hazards-cables');

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);

  useEffect(() => {
    if (!on || data) return; // fetch once — this dataset moves on a monthly timescale, no need to poll
    let cancelled = false;
    setBusy(true);
    loadHazards()
      .then((body) => {
        if (!cancelled) setData(body);
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
  }, [on, data]);

  useEffect(() => {
    if (!map) return;
    if (!on || !data) {
      clearHazards(map);
      return;
    }
    paintHazards(map, data);
  }, [map, on, data]);

  useEffect(() => {
    if (!map) return;
    return bindHazardsClick(map);
  }, [map]);

  useEffect(() => {
    return () => {
      if (map) clearHazards(map);
    };
  }, [map]);

  if (!on) {
    return (
      <section className="hz">
        <div className="hz-head">
          <span>Hazards</span>
        </div>
        <p className="hz-muted">Enable &quot;Submarine cables&quot; in Layers to show anchoring hazards.</p>
      </section>
    );
  }

  const cableCount = data?.cables.features.length ?? 0;
  const landingCount = data?.landingPoints.features.length ?? 0;

  return (
    <section className="hz">
      <div className="hz-head">
        <span>Hazards</span>
        {busy ? <span className="hz-muted">loading…</span> : null}
      </div>
      <p className="hz-note">
        Submarine telecom cables — a real hazard to your anchor/rode. Advisory only; always cross-check
        against a real chart before anchoring. {data?.attribution}
      </p>
      {error ? <p className="hz-err">{error}</p> : null}
      {data?.stale ? <p className="hz-warn">Showing a cached copy — refresh failed ({data.staleError})</p> : null}
      {data ? (
        <p className="hz-muted">
          {cableCount} cables, {landingCount} landing points. Click a line or point for detail.
        </p>
      ) : null}
    </section>
  );
}
