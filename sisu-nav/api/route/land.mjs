/**
 * Land avoidance: GSHHG-style polygons (Natural Earth 50m, GSHHS lineage).
 * Optional HTTP spike to signalk-weather-routing if that plugin is installed.
 * No GDAL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { destPoint, haversineNm } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAND_FILE = path.join(HERE, 'gshhg-land.geojson');
const UA = 'sisu-nav/0.1 (+yacht-sisu)';

let rings = null;

function loadRings() {
  if (rings) return rings;
  const fc = JSON.parse(fs.readFileSync(LAND_FILE, 'utf8'));
  const out = [];
  for (const f of fc.features || []) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
    for (const poly of polys) {
      const ring = poly[0];
      if (!ring || ring.length < 4) continue;
      let minx = Infinity;
      let miny = Infinity;
      let maxx = -Infinity;
      let maxy = -Infinity;
      for (const [x, y] of ring) {
        if (x < minx) minx = x;
        if (y < miny) miny = y;
        if (x > maxx) maxx = x;
        if (y > maxy) maxy = y;
      }
      out.push({ ring, minx, miny, maxx, maxy });
    }
  }
  rings = out;
  return rings;
}

function pip(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const inter = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-16) + xi;
    if (inter) inside = !inside;
  }
  return inside;
}

export function onLand(pt) {
  const lon = pt.lon;
  const lat = pt.lat;
  for (const r of loadRings()) {
    if (lon < r.minx || lon > r.maxx || lat < r.miny || lat > r.maxy) continue;
    if (pip(lon, lat, r.ring)) return true;
  }
  return false;
}

export function crossesLand(a, b) {
  if (onLand(a) || onLand(b)) return true;
  const n = Math.max(2, Math.ceil(haversineNm(a, b) / 1.5));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
    if (onLand(p)) return true;
  }
  return false;
}

/** Spiral off a coarse coastline so harbours still start a route. */
export function snapToWater(pt, toward, maxNm = 12) {
  if (!onLand(pt)) return { ...pt, snapped: false };
  const brg0 = toward ? bearingToward(pt, toward) : 180;
  for (let r = 0.3; r <= maxNm; r += 0.3) {
    for (let k = 0; k < 12; k++) {
      const brg = (brg0 + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * 30 + 360) % 360;
      const p = destPoint(pt, brg, r);
      if (!onLand(p)) return { ...p, snapped: true, from: pt };
    }
  }
  return { ...pt, snapped: false, landlocked: true };
}

function bearingToward(from, to) {
  const dLat = to.lat - from.lat;
  const dLon = to.lon - from.lon;
  return (Math.atan2(dLon, dLat) * 180) / Math.PI;
}

export function landStats() {
  return { source: 'gshhg-ne50m', rings: loadRings().length, gdal: false };
}

/**
 * Spike: HTTP probe only. signalk-weather-routing is experimental and is
 * not installed on this vessel today. Failure → GSHHG polygons.
 */
export async function weatherRoutingSpike(skUrl, token) {
  if (!skUrl) return { tried: false, installed: false };
  const headers = { 'user-agent': UA };
  if (token) headers.authorization = `Bearer ${token}`;
  const urls = [
    `${skUrl.replace(/\/$/, '')}/plugins/signalk-weather-routing`,
    `${skUrl.replace(/\/$/, '')}/plugins/signalk-weather-routing/`,
  ];
  for (const url of urls) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 1500);
      const res = await fetch(url, { headers, signal: ac.signal });
      clearTimeout(t);
      if (res.status === 404) continue;
      // 401/403 is SK's login wall on /plugins/*, not proof the plugin exists.
      if (res.ok) return { tried: true, installed: true, url };
    } catch {
      /* next */
    }
  }
  return { tried: true, installed: false };
}
