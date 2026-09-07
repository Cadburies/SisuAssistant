import { useEffect, useRef, useState } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { loadTilesets, type Tileset } from '../../app/config';
import type { PluginProps } from '../../app/plugin';
import type { Vessel } from '../../app/sk';
import { haversineM, radToDeg, wrapDeg } from '../../app/units';

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
        tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap © CARTO',
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
  const localIds = useRef(new Set<string>());

  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

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
    });
    mapRef.current = map;
    return () => {
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
      if (followRef.current) {
        map.easeTo({ center: next, duration: 400 });
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
    aisSrc?.setData(aisFc(sk.vessels, sk.selfId, Date.now()));
  }, [sk]);

  useEffect(() => {
    let stop = false;
    const sync = async () => {
      const listed = await loadTilesets();
      if (stop) return;
      await applyTilesets(mapRef.current, config.tileserver, listed, localIds.current);
    };
    const t = window.setInterval(sync, 8000);
    void sync();
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [config.tileserver]);

  return (
    <>
      <div ref={wrap} className="map-root" />
      <div className="map-hud">
        <button
          type="button"
          className={follow ? 'active' : ''}
          onClick={() => {
            const next = !followRef.current;
            followRef.current = next;
            setFollow(next);
            const s = sk;
            if (next && s.self.lat != null && s.self.lon != null) {
              mapRef.current?.easeTo({ center: [s.self.lon, s.self.lat], duration: 400 });
            }
          }}
        >
          {follow ? 'Following Sisu' : 'Follow Sisu'}
        </button>
      </div>
    </>
  );
}

async function applyTilesets(
  map: maplibregl.Map | null,
  tileserver: string,
  listed: Tileset[],
  seen: Set<string>,
) {
  if (!map?.isStyleLoaded()) return;
  for (const ts of listed) {
    const srcId = `local-${ts.id}`;
    if (seen.has(srcId) || map.getSource(srcId)) {
      seen.add(srcId);
      continue;
    }
    const tilejsonUrl = `${tileserver.replace(/\/$/, '')}/data/${encodeURIComponent(ts.id)}.json`;
    try {
      const res = await fetch(tilejsonUrl);
      if (!res.ok) continue;
      const tj = (await res.json()) as {
        tiles?: string[];
        format?: string;
        vector_layers?: unknown[];
      };
      const isVector = Boolean(tj.vector_layers) || tj.format === 'pbf';
      if (isVector) {
        map.addSource(srcId, { type: 'vector', url: tilejsonUrl });
      } else {
        map.addSource(srcId, {
          type: 'raster',
          tiles: tj.tiles,
          tileSize: 256,
        });
        map.addLayer(
          { id: `${srcId}-raster`, type: 'raster', source: srcId, paint: { 'raster-opacity': 0.92 } },
          'track-line',
        );
      }
      seen.add(srcId);
    } catch {
      /* tileserver has not reloaded this file yet */
    }
  }
}
