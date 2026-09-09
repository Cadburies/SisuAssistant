import { addProtocol, type Map as MapLibreMap, type RasterSourceSpecification } from 'maplibre-gl';
import type { LayerId } from '../map/layers';

const SRC = 'basemap-live-src';
const LAYER = 'basemap-live-raster';
const BING_PROTOCOL = 'bing-tile';

export type BasemapDef = {
  source: RasterSourceSpecification;
};

export type GoogleBasemapConfig = { configured: true; key: string; session: string; tileSize: number };
export type BingBasemapConfig = { configured: true; key: string; imageUrl: string; subdomains: string[] };

let bingConfig: BingBasemapConfig | null = null;
let bingProtocolRegistered = false;

/**
 * Bing addresses tiles by quadkey (a base-4-digit string encoding z/x/y
 * together), not separate {z}/{x}/{y} query params — MapLibre's raster
 * source has no native concept of that, so this registers a custom
 * `bing-tile://` protocol (MapLibre still substitutes {z}/{x}/{y} into the
 * URL before handing it to this handler) that converts to quadkey and
 * fetches the real tile itself. Standard, publicly documented algorithm
 * (Microsoft's "Bing Maps Tile System"), not anything proprietary.
 */
function toQuadKey(x: number, y: number, z: number): string {
  let quadKey = '';
  for (let i = z; i > 0; i--) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) digit += 1;
    if ((y & mask) !== 0) digit += 2;
    quadKey += digit.toString();
  }
  return quadKey;
}

export function setBingConfig(cfg: BingBasemapConfig | null): void {
  bingConfig = cfg;
}

function ensureBingProtocol(): void {
  if (bingProtocolRegistered) return;
  bingProtocolRegistered = true;
  addProtocol(BING_PROTOCOL, async (params) => {
    const m = /(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
    if (!m) throw new Error(`bing tile: unparseable url ${params.url}`);
    if (!bingConfig) throw new Error('bing tile: not configured');
    const [, zStr, xStr, yStr] = m;
    const z = Number(zStr);
    const x = Number(xStr);
    const y = Number(yStr);
    const quadkey = toQuadKey(x, y, z);
    const subdomains = bingConfig.subdomains.length ? bingConfig.subdomains : ['t0'];
    const subdomain = subdomains[(x + y) % subdomains.length];
    let url = bingConfig.imageUrl
      .replace('{subdomain}', subdomain)
      .replace('{quadkey}', quadkey)
      .replace('{culture}', 'en-US');
    // Not confirmed whether Bing's tile CDN itself requires the key (only
    // verified that the metadata call does) — appending it is harmless if
    // unnecessary, and needed if it turns out to be required. See
    // api/basemaps/index.mjs's header note: unverified against a real key.
    url += (url.includes('?') ? '&' : '?') + `key=${encodeURIComponent(bingConfig.key)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`bing tile fetch ${res.status}`);
    const data = await res.arrayBuffer();
    return { data };
  });
}

/**
 * Esri/OSM need no key — fixed templates. Mapbox needs the token from
 * RuntimeConfig (client-exposed by design, see server.mjs's /api/config
 * comment). Google needs a session (from GET /api/basemaps/google) whose
 * standard {z}/{x}/{y} template still needs the key on every tile request
 * per Google's own API contract — brokering the session server-side
 * doesn't hide the key, it just avoids a POST on every page load. Bing
 * needs metadata (from GET /api/basemaps/bing) plus the custom protocol
 * above. None of these five persist anything to disk — this is the
 * live-display-only counterpart to the harvestable versions in #117.
 */
export function basemapDef(
  id: LayerId,
  mapboxToken: string | null,
  google: GoogleBasemapConfig | null,
  bing: BingBasemapConfig | null,
): BasemapDef | null {
  switch (id) {
    case 'esri-live':
      return {
        source: {
          type: 'raster',
          tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS community',
        },
      };
    case 'osm-live':
      return {
        source: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      };
    case 'mapbox-live':
      if (!mapboxToken) return null;
      return {
        source: {
          type: 'raster',
          tiles: [`https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=${mapboxToken}`],
          tileSize: 256,
          attribution: '© Mapbox © Maxar',
        },
      };
    case 'google-live':
      if (!google) return null;
      return {
        source: {
          type: 'raster',
          tiles: [`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${google.session}&key=${google.key}`],
          tileSize: google.tileSize,
          attribution: '© Google',
        },
      };
    case 'bing-live':
      if (!bing) return null;
      setBingConfig(bing);
      ensureBingProtocol();
      return {
        source: {
          type: 'raster',
          tiles: [`${BING_PROTOCOL}://tile/{z}/{x}/{y}`],
          tileSize: 256,
          attribution: '© Microsoft Bing Maps',
        },
      };
    default:
      return null;
  }
}

function removeBasemap(map: MapLibreMap): void {
  if (map.getLayer(LAYER)) map.removeLayer(LAYER);
  if (map.getSource(SRC)) map.removeSource(SRC);
}

/** Swaps in `def`, or clears the live basemap entirely if `def` is null. */
export function setBasemap(map: MapLibreMap, def: BasemapDef | null): void {
  removeBasemap(map);
  if (!def) return;
  map.addSource(SRC, def.source);
  const before = map.getLayer('track-line') ? 'track-line' : undefined;
  map.addLayer({ id: LAYER, type: 'raster', source: SRC, paint: { 'raster-opacity': 1 } }, before);
}

/** MapLibre fires this when a live raster tile 404s/403s — otherwise the map just goes blank. */
export function bindBasemapErrors(
  map: MapLibreMap,
  onError: (msg: string | null) => void,
): () => void {
  let n = 0;
  const onErr = (e: { error?: Error; sourceId?: string }) => {
    const src = e.sourceId;
    const msg = e.error?.message || String(e.error || '');
    const ours = src === SRC || src === LAYER || /bing tile/i.test(msg);
    if (!ours && src) return;
    if (!ours && !map.getSource(SRC)) return;
    n += 1;
    onError(n === 1 ? `tile failed: ${msg || 'no data'}` : `${n} live tiles failed (${msg || 'no data'})`);
  };
  map.on('error', onErr);
  return () => {
    map.off('error', onErr);
  };
}
