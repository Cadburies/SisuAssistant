export type RuntimeConfig = {
  signalkHttp: string;
  tileserver: string;
  /** null when MAPBOX_ACCESS_TOKEN isn't configured server-side (#116). */
  mapboxToken: string | null;
};

const fallback = (): RuntimeConfig => {
  const host = window.location.hostname || '127.0.0.1';
  return {
    signalkHttp: `http://${host}:3000`,
    tileserver: `http://${host}:8087`,
    mapboxToken: null,
  };
};

export async function loadConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (!res.ok) return fallback();
    const j = (await res.json()) as Partial<RuntimeConfig>;
    const base = fallback();
    return {
      signalkHttp: j.signalkHttp || base.signalkHttp,
      tileserver: j.tileserver || base.tileserver,
      mapboxToken: j.mapboxToken || null,
    };
  } catch {
    return fallback();
  }
}

export type Tileset = { id: string; file: string; format: string; kind: string };

export async function loadTilesets(): Promise<Tileset[]> {
  try {
    const res = await fetch('/api/tilesets', { cache: 'no-store' });
    if (!res.ok) return [];
    const j = (await res.json()) as { tilesets?: Tileset[] };
    return j.tilesets ?? [];
  } catch {
    return [];
  }
}
