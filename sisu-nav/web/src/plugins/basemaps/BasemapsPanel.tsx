import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, registerLayer, subscribeLayers, type LayerId } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { basemapDef, setBasemap, type BingBasemapConfig, type GoogleBasemapConfig } from './overlay';
import './basemaps.css';

const LIVE_IDS: LayerId[] = ['esri-live', 'osm-live', 'mapbox-live', 'google-live', 'bing-live'];

const LABELS: Record<LayerId, string> = {
  'esri-live': 'Esri World Imagery',
  'osm-live': 'OpenStreetMap',
  'mapbox-live': 'Mapbox Satellite',
  'google-live': 'Google Satellite',
  'bing-live': 'Bing Aerial',
} as Record<LayerId, string>;

async function fetchGoogleSession(): Promise<GoogleBasemapConfig | null> {
  const res = await fetch('/api/basemaps/google');
  const body = (await res.json().catch(() => ({}))) as { configured?: boolean } & Partial<GoogleBasemapConfig>;
  if (!body.configured || !body.session || !body.key) return null;
  return { configured: true, key: body.key, session: body.session, tileSize: body.tileSize || 256 };
}

async function fetchBingMeta(): Promise<BingBasemapConfig | null> {
  const res = await fetch('/api/basemaps/bing');
  const body = (await res.json().catch(() => ({}))) as { configured?: boolean } & Partial<BingBasemapConfig>;
  if (!body.configured || !body.imageUrl || !body.key) return null;
  return { configured: true, key: body.key, imageUrl: body.imageUrl, subdomains: body.subdomains || [] };
}

export function BasemapsPanel({ config }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setLayerTick] = useState(0);
  const [google, setGoogle] = useState<GoogleBasemapConfig | null>(null);
  const [bing, setBing] = useState<BingBasemapConfig | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);

  // Grey-out state is the cheap RuntimeConfig presence check, not an actual
  // session/metadata fetch (that only happens once the layer is toggled on,
  // below) — see config.ts's comment on why these are kept separate.
  useEffect(() => {
    registerLayer({ id: 'mapbox-live', ready: Boolean(config.mapboxToken) });
    registerLayer({ id: 'google-live', ready: config.googleConfigured });
    registerLayer({ id: 'bing-live', ready: config.bingConfigured });
  }, [config.mapboxToken, config.googleConfigured, config.bingConfigured]);

  const active = LIVE_IDS.find((id) => isLayerOn(id)) ?? null;

  // Lazy fetch: only hit Google/Bing's session/metadata endpoint once that
  // specific layer is actually turned on — each costs a real upstream API
  // call the first time (session lasts ~2 weeks server-side after that).
  useEffect(() => {
    if (active === 'google-live' && !google) {
      fetchGoogleSession()
        .then(setGoogle)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }
    if (active === 'bing-live' && !bing) {
      fetchBingMeta()
        .then(setBing)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }
  }, [active, google, bing]);

  useEffect(() => {
    if (!map) return;
    if (!active) {
      setBasemap(map, null);
      return;
    }
    setBasemap(map, basemapDef(active, config.mapboxToken, google, bing));
  }, [map, active, config.mapboxToken, google, bing]);

  useEffect(() => {
    return () => {
      if (map) setBasemap(map, null);
    };
  }, [map]);

  const loadingGoogle = active === 'google-live' && !google;
  const loadingBing = active === 'bing-live' && !bing;

  return (
    <section className="bml">
      <div className="bml-head">
        <span>Basemap</span>
      </div>
      <p className="bml-muted">
        {active ? `${LABELS[active]} — live, un-cached` : 'Chart default. Toggle a live basemap in Layers.'}
        {loadingGoogle || loadingBing ? ' (connecting…)' : ''}
      </p>
      {error ? <p className="bml-err">{error}</p> : null}
    </section>
  );
}
