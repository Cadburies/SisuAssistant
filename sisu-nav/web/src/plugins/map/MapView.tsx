import { useEffect, useRef, useState } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { loadTilesets, type RuntimeConfig, type Tileset } from '../../app/config';
import type { PluginProps } from '../../app/plugin';
import type { Vessel } from '../../app/sk';
import { haversineM, radToDeg, wrapDeg } from '../../app/units';
import { fetchProviders } from '../harvest/api';
import type { Provider } from '../harvest/types';
import { settleLiveUnderlay } from '../basemaps/overlay';
import { rankForView, resolveSource } from './availability';
import { getBasemap, getLastLive, setUnderlay, subscribeBasemap } from './basemap';
import { hits, type Bbox } from './geo';
import { liveFailing, subscribeLiveHealth } from './liveHealth';
import { buildSources, type ChartFile } from './sources';
import { getHere, subscribeHere } from './here';
import { isLayerOn, subscribeLayers } from './layers';
import { setNavMap } from './registry';

const BVI: [number, number] = [-64.623, 18.431];
const AIS_STALE_MS = 15 * 60 * 1000;
const TRACK_MAX = 3600;

function floorStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'sisu-nav-floor',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  };
}

function boatImage(fill: string, stroke: string, w = 48, h = 72): ImageData {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.translate(w / 2, h / 2);
  g.beginPath();
  g.moveTo(0, -h / 2 + 3);
  g.lineTo(w / 2 - 5, h / 2 - 6);
  g.lineTo(0, h / 2 - 16);
  g.lineTo(-(w / 2 - 5), h / 2 - 6);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = stroke;
  g.lineWidth = 2;
  g.stroke();
  return g.getImageData(0, 0, w, h);
}

function hereImage(fill: string, stroke: string, size = 28): ImageData {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const r = size / 2 - 3;
  g.beginPath();
  g.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = stroke;
  g.lineWidth = 3;
  g.stroke();
  return g.getImageData(0, 0, size, size);
}

function headingDeg(v: Vessel): number {
  if (v.heading != null) return wrapDeg(radToDeg(v.heading));
  if (v.cog != null) return wrapDeg(radToDeg(v.cog));
  return 0;
}

function selfFc(self: Vessel, track: [number, number][]) {
  const features: GeoJSON.Feature[] = [];
  if (track.length >= 2) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: track },
    });
  }
  if (self.lat != null && self.lon != null) {
    features.push({
      type: 'Feature',
      properties: { heading: headingDeg(self), name: 'Sisu' },
      geometry: { type: 'Point', coordinates: [self.lon, self.lat] },
    });
  }
  return { type: 'FeatureCollection' as const, features };
}

function aisFc(vessels: Record<string, Vessel>, selfId: string, now: number) {
  const features: GeoJSON.Feature[] = [];
  for (const [id, v] of Object.entries(vessels)) {
    if (id === selfId) continue;
    if (!v.lat || !v.lon) continue;
    if (now - v.updatedAt > AIS_STALE_MS) continue;
    features.push({
      type: 'Feature',
      properties: {
        id,
        name: v.name || v.mmsi || id.replace(/^vessels\./, ''),
        heading: headingDeg(v),
        sog: v.sog ?? null,
        mmsi: v.mmsi || '',
      },
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
    });
  }
  return { type: 'FeatureCollection' as const, features };
}

export function MapView({ sk, config }: PluginProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const trackRef = useRef<[number, number][]>([]);
  const followRef = useRef(true);
  const [follow, setFollow] = useState(true);
  const [layerTick, setLayerTick] = useState(0);
  const [baseTick, setBaseTick] = useState(0);
  const [liveTick, setLiveTick] = useState(0);
  const [hereTick, setHereTick] = useState(0);
  const localRevs = useRef(new Map<string, string>());

  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);
  useEffect(() => subscribeBasemap(() => setBaseTick((n) => n + 1)), []);
  useEffect(() => subscribeLiveHealth(() => setLiveTick((n) => n + 1)), []);
  useEffect(() => subscribeHere(() => setHereTick((n) => n + 1)), []);

  useEffect(() => {
    if (!wrap.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: wrap.current,
      style: floorStyle(),
      center: BVI,
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.on('dragstart', () => {
      followRef.current = false;
      setFollow(false);
    });
    map.on('load', () => {
      map.addImage('own-boat', boatImage('#e0b43a', '#fff8e0'));
      map.addImage('ais-boat', boatImage('#3ec6d8', '#dff8ff'));
      map.addImage('here-dot', hereImage('#fff8e0', '#e0b43a'));
      map.addSource('track', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('own', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('ais', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource('here', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#e0b43a', 'line-width': 2, 'line-opacity': 0.85 },
      });
      map.addLayer({
        id: 'own-icon',
        type: 'symbol',
        source: 'own',
        filter: ['==', ['geometry-type'], 'Point'],
        layout: {
          'icon-image': 'own-boat',
          'icon-size': 0.55,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
        },
      });
      map.addLayer({
        id: 'ais-icon',
        type: 'symbol',
        source: 'ais',
        layout: {
          'icon-image': 'ais-boat',
          'icon-size': 0.4,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-optional': true,
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        },
        paint: { 'text-color': '#cfeaf0', 'text-halo-color': '#070b10', 'text-halo-width': 1 },
      });
      map.addLayer({
        id: 'here-icon',
        type: 'symbol',
        source: 'here',
        layout: {
          'icon-image': 'here-dot',
          'icon-size': 0.9,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      map.on('click', 'ais-icon', (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== 'Point') return;
        const p = f.properties || {};
        const sog =
          typeof p.sog === 'number' ? `${(p.sog * 1.943844).toFixed(1)} kn` : '—';
        new maplibregl.Popup()
          .setLngLat(f.geometry.coordinates as [number, number])
          .setHTML(
            `<strong>${p.name || 'AIS'}</strong><br/>MMSI ${p.mmsi || '—'}<br/>SOG ${sog}`,
          )
          .addTo(map);
      });
      map.on('mouseenter', 'ais-icon', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'ais-icon', () => {
        map.getCanvas().style.cursor = '';
      });
      setNavMap(map);
      void loadTilesets().then((listed) => {
        void applyTilesets(map, config, listed, localRevs.current);
      });
    });
    mapRef.current = map;
    return () => {
      setNavMap(null);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const self = sk.self;
    if (self.lat != null && self.lon != null) {
      const track = trackRef.current;
      const last = track[track.length - 1];
      const next: [number, number] = [self.lon, self.lat];
      if (!last || haversineM(last[1], last[0], self.lat, self.lon) >= 4) {
        track.push(next);
        if (track.length > TRACK_MAX) track.splice(0, track.length - TRACK_MAX);
      }
    }
    const own = selfFc(self, trackRef.current);
    const trackSrc = map.getSource('track') as maplibregl.GeoJSONSource | undefined;
    const ownSrc = map.getSource('own') as maplibregl.GeoJSONSource | undefined;
    const aisSrc = map.getSource('ais') as maplibregl.GeoJSONSource | undefined;
    trackSrc?.setData({
      type: 'FeatureCollection',
      features: own.features.filter((f) => f.geometry.type === 'LineString'),
    });
    ownSrc?.setData({
      type: 'FeatureCollection',
      features: own.features.filter((f) => f.geometry.type === 'Point'),
    });
    aisSrc?.setData(
      isLayerOn('ais')
        ? aisFc(sk.vessels, sk.selfId, Date.now())
        : { type: 'FeatureCollection', features: [] },
    );
  }, [sk, layerTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const here = getHere();
    const src = map.getSource('here') as maplibregl.GeoJSONSource | undefined;
    if (here?.ok) {
      src?.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [here.lon, here.lat] },
          },
        ],
      });
      if (followRef.current) {
        map.easeTo({ center: [here.lon, here.lat], duration: 400 });
      }
    } else {
      src?.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [hereTick, follow]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const sync = async () => {
      const listed = await loadTilesets();
      if (stop) return;
      await applyTilesets(mapRef.current, config, listed, localRevs.current);
    };
    const kick = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void sync();
      }, 250);
    };
    const map = mapRef.current;
    map?.on('moveend', kick);
    const t = window.setInterval(sync, 3000);
    void sync();
    return () => {
      stop = true;
      window.clearTimeout(timer);
      window.clearInterval(t);
      map?.off('moveend', kick);
    };
  }, [config, baseTick, liveTick]);

  const here = getHere();

  return (
    <>
      <div ref={wrap} className="map-root" />
      <div className="map-hud">
        <button
          type="button"
          className={follow ? 'active' : ''}
          title={here && !here.ok ? here.error : undefined}
          onClick={() => {
            const next = !followRef.current;
            followRef.current = next;
            setFollow(next);
            const fix = getHere();
            if (next && fix?.ok) {
              mapRef.current?.easeTo({ center: [fix.lon, fix.lat], duration: 400 });
            }
          }}
        >
          {follow ? 'Following me' : 'Follow me'}
        </button>
        {follow && here && !here.ok ? <span className="map-hud-err">{here.error}</span> : null}
      </div>
    </>
  );
}

function tilesetRev(ts: Tileset): string {
  return `${ts.mtimeMs ?? 0}:${ts.bytes ?? 0}`;
}

function bustTileUrl(url: string, rev: string): string {
  const v = encodeURIComponent(rev);
  return url.includes('?') ? `${url}&v=${v}` : `${url}?v=${v}`;
}

function removeLocalSource(map: maplibregl.Map, srcId: string): void {
  const layerId = `${srcId}-raster`;
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(srcId)) map.removeSource(srcId);
}

let providerCache: Provider[] = [];

function mapView(map: maplibregl.Map): { bbox: Bbox; zoom: number } | null {
  const b = map.getBounds();
  const zoom = map.getZoom();
  if (!Number.isFinite(zoom)) return null;
  return { bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: Math.round(zoom) };
}

function paintFiles(files: ChartFile[], choiceFile: string | undefined, view: { bbox: Bbox; zoom: number }): ChartFile[] {
  const inView = files.filter((f) => f.bounds && hits(f.bounds, view.bbox, true));
  if (!choiceFile) return inView;
  return inView.filter((f) => f.file === choiceFile);
}

async function applyTilesets(
  map: maplibregl.Map | null,
  config: RuntimeConfig,
  listed: Tileset[],
  seen: Map<string, string>,
) {
  if (!map?.isStyleLoaded()) return;
  try {
    providerCache = await fetchProviders();
  } catch {
    /* keep the last good provider list */
  }
  const view = mapView(map);
  if (!view) return;
  const sources = buildSources(providerCache, listed);
  const ctx = {
    keys: {
      mapbox: Boolean(config.mapboxToken),
      google: config.googleConfigured,
      azure: config.azureConfigured,
    },
    liveFailing: liveFailing(),
    lastLiveId: getLastLive(),
  };
  const ranked = rankForView(sources, view, ctx);
  const choice = getBasemap();
  const source = resolveSource(choice, sources, ranked.auto);
  const files = source ? paintFiles(source.files, choice.kind === 'source' ? choice.file : undefined, view) : [];
  const byFile = new Map(listed.map((ts) => [ts.file, ts]));
  const wanted = files
    .map((f) => ({ file: f, ts: byFile.get(f.file) }))
    .filter((x): x is { file: ChartFile; ts: Tileset } => x.ts != null && x.ts.kind !== 'bathymetry');
  const liveId = source?.liveId && source.liveId !== 'osm' ? source.liveId : null;
  const liveBlocked =
    (liveId === 'mapbox' && !config.mapboxToken) ||
    (liveId === 'google' && !config.googleConfigured) ||
    (liveId === 'azure' && !config.azureConfigured) ||
    (liveId != null && liveFailing().has(liveId));
  setUnderlay(liveBlocked ? null : liveId);

  const wantedIds = new Set(wanted.map((x) => `local-${x.ts.id}`));
  for (const srcId of [...seen.keys()]) {
    if (wantedIds.has(srcId)) continue;
    removeLocalSource(map, srcId);
    seen.delete(srcId);
  }
  for (const { file, ts } of wanted) {
    const srcId = `local-${ts.id}`;
    const rev = `${tilesetRev(ts)}|${file.minZoom ?? ''}|${file.maxZoom ?? ''}|${file.bounds?.join(',') ?? ''}`;
    if (seen.get(srcId) === rev && map.getSource(srcId)) continue;
    if (map.getSource(srcId)) removeLocalSource(map, srcId);
    const tilejsonUrl = `${config.tileserver.replace(/\/$/, '')}/data/${encodeURIComponent(ts.id)}.json`;
    try {
      const res = await fetch(`${tilejsonUrl}?v=${encodeURIComponent(tilesetRev(ts))}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const tj = (await res.json()) as {
        tiles?: string[];
        format?: string;
        vector_layers?: unknown[];
        attribution?: string;
        tileSize?: number;
      };
      const attribution = tj.attribution?.trim() || undefined;
      const isVector = Boolean(tj.vector_layers) || tj.format === 'pbf';
      const coverage = {
        ...(file.bounds ? { bounds: file.bounds } : {}),
        ...(file.minZoom != null ? { minzoom: file.minZoom } : {}),
        ...(file.maxZoom != null ? { maxzoom: file.maxZoom } : {}),
      };
      if (isVector) {
        map.addSource(srcId, {
          type: 'vector',
          url: `${tilejsonUrl}?v=${encodeURIComponent(tilesetRev(ts))}`,
          ...(attribution ? { attribution } : {}),
          ...coverage,
        });
      } else {
        if (!tj.tiles?.length) continue;
        map.addSource(srcId, {
          type: 'raster',
          tiles: tj.tiles.map((u) => bustTileUrl(u, tilesetRev(ts))),
          tileSize: tj.tileSize || ts.tileSize || 256,
          ...(attribution ? { attribution } : {}),
          ...coverage,
        });
        map.addLayer(
          { id: `${srcId}-raster`, type: 'raster', source: srcId, paint: { 'raster-opacity': 1 } },
          'track-line',
        );
      }
      seen.set(srcId, rev);
    } catch {
      /* tileserver has not reloaded this file yet */
    }
  }
  settleLiveUnderlay(map);
}
