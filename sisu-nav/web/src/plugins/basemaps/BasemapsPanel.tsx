import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, registerLayer, subscribeLayers, type LayerId } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import {
  basemapDef,
  bindBasemapErrors,
  setBasemap,
  type GoogleBasemapConfig,
} from './overlay';
import './basemaps.css';

const LIVE_IDS: LayerId[] = ['esri-live', 'osm-live', 'mapbox-live', 'google-live', 'azure-live'];

const LABELS: Record<LayerId, string> = {
  'esri-live': 'Esri World Imagery',
  'osm-live': 'OpenStreetMap',
  'mapbox-live': 'Mapbox Satellite',
  'google-live': 'Google Satellite',
  'azure-live': 'Azure Maps Imagery',
} as Record<LayerId, string>;

async function fetchGoogleSession(): Promise<GoogleBasemapConfig | null> {
  const res = await fetch('/api/basemaps/google');
  const body = (await res.json().catch(() => ({}))) as {
    configured?: boolean;
    error?: string;
  } & Partial<GoogleBasemapConfig>;
  if (!res.ok) throw new Error(body.error || `Google session HTTP ${res.status}`);
  if (!body.configured) return null;
  if (!body.session || !body.key) throw new Error('Google session response missing session/key');
  return { configured: true, key: body.key, session: body.session, tileSize: body.tileSize || 256 };
}

export function BasemapsPanel({ config }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setLayerTick] = useState(0);
  const [google, setGoogle] = useState<GoogleBasemapConfig | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [googleTried, setGoogleTried] = useState(false);

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);

  useEffect(() => {
    registerLayer({ id: 'mapbox-live', ready: Boolean(config.mapboxToken) });
    registerLayer({ id: 'google-live', ready: config.googleConfigured });
    registerLayer({ id: 'azure-live', ready: Boolean(config.azureMapsKey) });
  }, [config.mapboxToken, config.googleConfigured, config.azureMapsKey]);

  const active = LIVE_IDS.find((id) => isLayerOn(id)) ?? null;

  useEffect(() => {
    setError(undefined);
    if (active !== 'google-live') setGoogleTried(false);
  }, [active]);

  useEffect(() => {
    if (active === 'google-live' && !google && !googleTried) {
      setGoogleTried(true);
      fetchGoogleSession()
        .then((g) => {
          if (g) setGoogle(g);
          else setError('Google Maps key is not configured on the server.');
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }
  }, [active, google, googleTried]);

  useEffect(() => {
    if (!map) return;
    if (!active) {
      setBasemap(map, null);
      return;
    }
    setBasemap(map, basemapDef(active, config.mapboxToken, google, config.azureMapsKey));
  }, [map, active, config.mapboxToken, config.azureMapsKey, google]);

  useEffect(() => {
    if (!map) return;
    return bindBasemapErrors(map, (msg) => setError(msg || undefined));
  }, [map]);

  useEffect(() => {
    return () => {
      if (map) setBasemap(map, null);
    };
  }, [map]);

  const loadingGoogle = active === 'google-live' && !google && !error;

  return (
    <section className="bml">
      <div className="bml-head">
        <span>Basemap</span>
      </div>
      <p className="bml-muted">
        {active ? `${LABELS[active]} — live, un-cached` : 'Chart default. Toggle a live basemap in Layers.'}
        {loadingGoogle ? ' (connecting…)' : ''}
      </p>
      {error ? <p className="bml-err">{error}</p> : null}
    </section>
  );
}
