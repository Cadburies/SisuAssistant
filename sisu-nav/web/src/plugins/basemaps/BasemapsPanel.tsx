import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { getBasemap, subscribeBasemap } from '../map/basemap';
import { subscribeNavMap } from '../map/registry';
import { basemapDef, bindBasemapErrors, setBasemap, type GoogleBasemapConfig } from './overlay';

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

/** Applies the Charts-selected live basemap. No UI — picker lives on Charts. */
export function LiveBasemapSync({ config }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [choice, setChoice] = useState(getBasemap);
  const [google, setGoogle] = useState<GoogleBasemapConfig | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [googleTried, setGoogleTried] = useState(false);

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeBasemap(() => setChoice(getBasemap())), []);

  const liveId = choice.kind === 'live' ? choice.id : null;

  useEffect(() => {
    setError(undefined);
    if (liveId !== 'google') setGoogleTried(false);
  }, [liveId]);

  useEffect(() => {
    if (liveId === 'google' && !google && !googleTried) {
      setGoogleTried(true);
      fetchGoogleSession()
        .then((g) => {
          if (g) setGoogle(g);
          else setError('Google Maps key is not configured on the server.');
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }
  }, [liveId, google, googleTried]);

  useEffect(() => {
    if (!map) return;
    if (!liveId || liveId === 'carto') {
      setBasemap(map, null);
      return;
    }
    setBasemap(map, basemapDef(liveId, config.mapboxToken, google, config.azureMapsKey));
  }, [map, liveId, config.mapboxToken, config.azureMapsKey, google]);

  useEffect(() => {
    if (!map) return;
    return bindBasemapErrors(map, (msg) => setError(msg || undefined));
  }, [map]);

  useEffect(() => {
    return () => {
      if (map) setBasemap(map, null);
    };
  }, [map]);

  if (!error) return null;
  return <p className="hv-bad">{error}</p>;
}
