import { encodeGeohash, geohashCenter } from './geohash.mjs';
import {
  BINS,
  CALM_MAX,
  emptyCounts,
  GEOHASH_PRECISION,
  MIN_CELL_SAMPLES,
  binOf,
  sectorOf,
  toRose,
} from './spec.mjs';

const POS_SLACK_MS = 5 * 60 * 1000;

function nearest(sorted, t, slack) {
  if (!sorted.length) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  let best = sorted[lo];
  let bestD = Math.abs(best.t - t);
  if (lo > 0) {
    const d = Math.abs(sorted[lo - 1].t - t);
    if (d < bestD) {
      best = sorted[lo - 1];
      bestD = d;
    }
  }
  return bestD <= slack ? best.v : null;
}

function inBbox(lat, lon, bbox) {
  if (!bbox) return true;
  return lon >= bbox.west && lon <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

export function aggregate(series, bbox) {
  const twd = series.get('sensor.nmea_twd') || [];
  const aws = series.get('sensor.nmea_aws') || [];
  const lats = series.get('sensor.nmea_latitude') || [];
  const lons = series.get('sensor.nmea_longitude') || [];
  const cells = new Map();
  let joined = 0;
  let skippedNoPos = 0;

  for (const p of twd) {
    const speed = nearest(aws, p.t, 60 * 1000);
    if (speed == null) continue;
    const lat = nearest(lats, p.t, POS_SLACK_MS);
    const lon = nearest(lons, p.t, POS_SLACK_MS);
    if (lat == null || lon == null) {
      skippedNoPos += 1;
      continue;
    }
    if (!inBbox(lat, lon, bbox)) continue;
    joined += 1;
    const gh = encodeGeohash(lat, lon, GEOHASH_PRECISION);
    let cell = cells.get(gh);
    if (!cell) {
      cell = { geohash: gh, calm: 0, used: 0, counts: emptyCounts() };
      cells.set(gh, cell);
    }
    cell.used += 1;
    if (speed < CALM_MAX) {
      cell.calm += 1;
      continue;
    }
    const sector = sectorOf(p.v);
    const b = binOf(speed);
    const bi = BINS.findIndex((x) => x.id === b.id);
    cell.counts[bi][sector] += 1;
  }

  const out = [];
  for (const cell of cells.values()) {
    if (cell.used < MIN_CELL_SAMPLES) continue;
    const center = geohashCenter(cell.geohash);
    out.push({
      geohash: cell.geohash,
      lat: center.lat,
      lon: center.lon,
      ...toRose(cell.counts, cell.calm, cell.used),
    });
  }
  out.sort((a, b) => b.n - a.n);
  return { cells: out, joined, skippedNoPos, rawTwd: twd.length, rawAws: aws.length };
}
