import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { getUnderlay, subscribeUnderlay, type LiveBasemapId } from '../map/basemap';
import { markLiveFailing } from '../map/liveHealth';
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
  const [liveId, setLiveId] = useState<LiveBasemapId | null>(getUnderlay);
  const [google, setGoogle] = useState<GoogleBasemapConfig | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [googleTried, setGoogleTried] = useState(false);

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeUnderlay(() => setLiveId(getUnderlay())), []);

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
    if (!liveId || liveId === 'osm') {
      setBasemap(map, null);
      return;
    }
    setBasemap(map, basemapDef(liveId, config.mapboxToken, google, config.azureConfigured));
  }, [map, liveId, config.mapboxToken, config.azureConfigured, google]);

  useEffect(() => {
    if (!map) return;
    return bindBasemapErrors(map, (msg) => {
      setError(msg || undefined);
      if (msg && liveId) markLiveFailing(liveId);
    });
  }, [map, liveId]);

  useEffect(() => {
    return () => {
      if (map) setBasemap(map, null);
    };
  }, [map]);

  if (!error) return null;
  return <p className="hv-bad">{error}</p>;
}
