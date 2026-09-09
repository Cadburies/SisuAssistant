import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { bindAisGlobalClick, clearAisGlobal, paintAisGlobal } from './overlay';
import type { AisGlobalResponse } from './types';
import './ais-global.css';

const POLL_MS = 60 * 1000;

async function loadVessels(): Promise<AisGlobalResponse> {
  const res = await fetch('/api/ais-global/vessels');
  const body = (await res.json().catch(() => ({}))) as Partial<AisGlobalResponse>;
  return {
    connected: Boolean(body.connected),
    error: body.error ?? null,
    boundingBoxes: body.boundingBoxes,
    vessels: Array.isArray(body.vessels) ? body.vessels : [],
  };
}

export function AisGlobalPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setLayerTick] = useState(0);
  const [data, setData] = useState<AisGlobalResponse | null>(null);
  const on = isLayerOn('ais-global');

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    const run = async () => {
      try {
        const body = await loadVessels();
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setData((prev) => prev ?? { connected: false, error: 'fetch failed', boundingBoxes: null, vessels: [] });
      }
    };
    void run();
    const t = window.setInterval(run, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [on]);

  useEffect(() => {
    if (!map) return;
    if (!on || !data) {
      clearAisGlobal(map);
      return;
    }
    paintAisGlobal(map, data.vessels);
  }, [map, on, data]);

  useEffect(() => {
    if (!map) return;
    return bindAisGlobalClick(map);
  }, [map]);

  useEffect(() => {
    return () => {
      if (map) clearAisGlobal(map);
    };
  }, [map]);

  if (!on) {
    return (
      <section className="aisg">
        <div className="aisg-head">
          <span>AIS (global)</span>
        </div>
        <p className="aisg-muted">
          Enable &quot;AIS (global, internet)&quot; in Layers to show internet-sourced traffic.
        </p>
      </section>
    );
  }

  return (
    <section className="aisg">
      <div className="aisg-head">
        <span>AIS (global)</span>
        {data?.connected ? <span className="aisg-ok">live</span> : <span className="aisg-wait">connecting…</span>}
      </div>
      <p className="aisg-note">
        Internet-sourced (AISStream.io, tier 4) — longer range than this boat's own receiver, not a
        substitute for local collision avoidance.
      </p>
      {data?.error ? <p className="aisg-err">{data.error}</p> : null}
      {data ? <p className="aisg-muted">{data.vessels.length} vessel(s) in range</p> : null}
    </section>
  );
}
