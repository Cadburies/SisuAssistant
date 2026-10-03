/**
 * Anchor-spot wind roses (#187) — pure detection + per-hour aggregation.
 *
 * Input is Sisu_1m, which only holds a minute when HA wrote a state change:
 * a boat sitting still logs few positions, an engine that is off logs no RPM
 * (YDEG-04 goes silent), instruments that are off log no wind. So positions
 * and SOG are forward-filled, and "no RPM" means engines off.
 *
 * A stay = stretch within STAY_RADIUS_M of its running centroid, engines off,
 * SOG low, ≥ MIN_STAY_MIN long. It counts as anchored when the anchor alarm
 * was armed, or when the boat swings (heading circular std ≥ SWING_MIN_DEG) —
 * a dock or slip on lines does not swing. TWD only exists when heading does,
 * so every stay that can carry a rose can also be swing-checked.
 *
 * Stays that don't swing are kept as source 'berth' (marina slip / dock):
 * collected always, shown + synced only when the berths opt-in is on
 * (anchor-store.mjs). Their bow heading is kept so the rose can show how
 * the wind lies on the boat.
 */
import { encodeGeohash } from './geohash.mjs';
import { BINS, CALM_MAX, binOf, emptyCounts, sectorOf, toRose } from './spec.mjs';

const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const OPTS = {
  stayRadiusM: num('ANCHOR_STAY_RADIUS_M', 150),
  minStayMin: num('ANCHOR_MIN_STAY_MIN', 45),
  sogMaxKn: num('ANCHOR_SOG_MAX_KN', 1.5),
  rpmMotoring: 30,
  swingMinDeg: num('ANCHOR_SWING_MIN_DEG', 6),
  bowOffWindMaxDeg: num('ANCHOR_BOW_OFF_WIND_MAX_DEG', 60),
  mergeM: num('ANCHOR_SPOT_MERGE_M', 100),
  posHoldMs: 3 * 3600 * 1000,
  sogHoldMs: 30 * 60 * 1000,
  rpmHoldMs: 3 * 60 * 1000,
  gapTolMin: 5,
};

export const MEASUREMENTS = [
  'sensor.nmea_latitude',
  'sensor.nmea_longitude',
  'sensor.nmea_sog',
  'sensor.nmea_twd',
  'sensor.nmea_aws',
  'sensor.nmea_aws_gust',
  'sensor.nmea_heading_true',
  'sensor.sisu_engine_port_rpm',
  'sensor.sisu_engine_starboard_rpm',
  'input_boolean.sisu_anchor_alarm_enabled',
  'input_boolean.sisu_anchor_drop_set',
  'input_number.sisu_anchor_drop_lat',
  'input_number.sisu_anchor_drop_lon',
];

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const R_EARTH = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function distM(lat1, lon1, lat2, lon2) {
  const dphi = rad(lat2 - lat1);
  const dl = rad(lon2 - lon1);
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function median(xs) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function quantile(xs, q) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

/** Last sample at or before t (sorted by t), if no older than hold. */
function lastAt(sorted, t, hold, cursor) {
  let i = cursor.i;
  while (i + 1 < sorted.length && sorted[i + 1].t <= t) i += 1;
  cursor.i = i;
  const s = sorted[i];
  if (!s || s.t > t || t - s.t > hold) return null;
  return s.v;
}

/** Pair lat/lon by minute, drop impossible values and lone spikes. */
export function cleanPositions(lats, lons) {
  const byT = new Map();
  for (const p of lats) byT.set(p.t, { t: p.t, lat: p.v });
  const out = [];
  for (const p of lons) {
    const row = byT.get(p.t);
    if (!row) continue;
    row.lon = p.v;
    out.push(row);
  }
  const valid = out
    .filter((p) => Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 && !(p.lat === 0 && p.lon === 0))
    .sort((a, b) => a.t - b.t);
  // Spike = > 1 km from the median of its ±2 neighbours (the bucket has held
  // lat 244 / lon 101 garbage). Real moves stay because neighbours move too.
  return valid.filter((p, i) => {
    const nb = valid.slice(Math.max(0, i - 2), i + 3).filter((q) => q !== p);
    if (nb.length < 2) return true;
    return distM(p.lat, p.lon, median(nb.map((q) => q.lat)), median(nb.map((q) => q.lon))) <= 1000;
  });
}

function circStats(degs) {
  let s = 0;
  let c = 0;
  for (const d of degs) {
    s += Math.sin(rad(d));
    c += Math.cos(rad(d));
  }
  const n = degs.length;
  const r = n ? Math.sqrt(s * s + c * c) / n : 0;
  const stdDeg = r > 0 ? (Math.sqrt(-2 * Math.log(Math.min(1, r))) * 180) / Math.PI : 180;
  return { sin: s, cos: c, r, stdDeg };
}

const inRange = (arr, t0, t1) => arr.filter((p) => p.t >= t0 && p.t < t1);

/** |circular mean of (TWD − heading)| over non-calm minutes, or null if < 10. */
function bowOffWind(heading, twd, aws) {
  let s = 0;
  let c = 0;
  let n = 0;
  for (const h of heading) {
    const d = nearestVal(twd, h.t, MIN);
    const v = nearestVal(aws, h.t, MIN);
    if (d == null || v == null || v < CALM_MAX) continue;
    s += Math.sin(rad(d - h.v));
    c += Math.cos(rad(d - h.v));
    n += 1;
  }
  if (n < 10) return null;
  return Math.abs((Math.atan2(s, c) * 180) / Math.PI);
}

/**
 * Stays from a Sisu_1m series Map (measurement → [{t, v}] sorted).
 * Returns [{ start, end, lat, lon, source, accepted, reason, headingStd }].
 */
export function detectStays(series, opts = OPTS) {
  const get = (m) => series.get(m) || [];
  const pos = cleanPositions(get('sensor.nmea_latitude'), get('sensor.nmea_longitude'));
  if (!pos.length) return [];
  const sog = get('sensor.nmea_sog');
  const rpm = [...get('sensor.sisu_engine_port_rpm'), ...get('sensor.sisu_engine_starboard_rpm')].sort(
    (a, b) => a.t - b.t,
  );
  const t0 = Math.floor(pos[0].t / MIN) * MIN;
  const lastT = (a) => (a.length ? a[a.length - 1].t : 0);
  const t1 = Math.max(lastT(pos), lastT(sog), lastT(get('sensor.nmea_twd')));
  const pc = { i: 0 };
  const sc = { i: 0 };
  const rc = { i: 0 };
  const posSeries = pos.map((p) => ({ t: p.t, v: p }));

  const stays = [];
  let cur = null;
  let bad = 0;
  const close = () => {
    if (cur && cur.lastT - cur.start >= opts.minStayMin * MIN) stays.push(cur);
    cur = null;
    bad = 0;
  };
  for (let t = t0; t <= t1; t += MIN) {
    const p = lastAt(posSeries, t, opts.posHoldMs, pc);
    const s = lastAt(sog, t, opts.sogHoldMs, sc);
    const r = lastAt(rpm, t, opts.rpmHoldMs, rc);
    const ok = p && !(r != null && r > opts.rpmMotoring) && !(s != null && s >= opts.sogMaxKn);
    if (!ok) {
      if (cur && ++bad > opts.gapTolMin) close();
      continue;
    }
    if (cur) {
      const cLat = cur.latSum / cur.k;
      const cLon = cur.lonSum / cur.k;
      if (distM(p.lat, p.lon, cLat, cLon) > opts.stayRadiusM) close();
    }
    if (!cur) cur = { start: t, lastT: t, latSum: 0, lonSum: 0, k: 0, pts: [] };
    bad = 0;
    cur.lastT = t;
    cur.latSum += p.lat;
    cur.lonSum += p.lon;
    cur.k += 1;
    cur.pts.push({ t, lat: p.lat, lon: p.lon });
  }
  close();

  const armed = get('input_boolean.sisu_anchor_alarm_enabled');
  const dropSet = get('input_boolean.sisu_anchor_drop_set');
  const dLat = get('input_number.sisu_anchor_drop_lat');
  const dLon = get('input_number.sisu_anchor_drop_lon');
  const heading = get('sensor.nmea_heading_true');
  const twd = get('sensor.nmea_twd');
  const aws = get('sensor.nmea_aws');

  return stays.map((st) => {
    const end = st.lastT + MIN;
    // Median over the whole stay spans several swing directions, so it lands
    // near the anchor instead of downwind of it like a single-wind centroid.
    let lat = median(st.pts.map((q) => q.lat));
    let lon = median(st.pts.map((q) => q.lon));
    let source = 'swing';
    // HA logs on change only: armed before the stay began shows up as the
    // last value before start, not as a sample inside it.
    const wasArmed =
      lastAt(armed, st.start, Infinity, { i: 0 }) >= 0.5 || inRange(armed, st.start, end).some((x) => x.v >= 0.5);
    if (wasArmed) {
      source = 'alarm';
      const setNow = inRange(dropSet, st.start, end).some((x) => x.v >= 0.5) || lastAt(dropSet, end, Infinity, { i: 0 }) >= 0.5;
      const a = lastAt(dLat, end, Infinity, { i: 0 });
      const b = lastAt(dLon, end, Infinity, { i: 0 });
      if (setNow && a != null && b != null && distM(a, b, lat, lon) <= 300) {
        lat = a;
        lon = b;
      }
    }
    const hd = inRange(heading, st.start, end).map((x) => x.v);
    const hs = circStats(hd);
    let accepted = wasArmed;
    let undecided = false;
    let reason = wasArmed ? 'anchor alarm armed' : '';
    if (!accepted) {
      if (hd.length < 10) {
        // The store accepts it if it continues an anchored stay it already holds.
        undecided = true;
        reason = 'no heading (instruments off)';
      }
      else {
        // At anchor the bow weathervanes into the wind (heading ≈ TWD). Loose
        // slip lines can let heading wander a few degrees, but the bow stays
        // wherever the dock put it — found live: σ 8.7° in a slip, bow 150°
        // off the trades. Needs non-calm wind; without it, σ alone decides.
        const off = bowOffWind(inRange(heading, st.start, end), inRange(twd, st.start, end), inRange(aws, st.start, end));
        const intoWind = off == null || off <= opts.bowOffWindMaxDeg;
        const offTxt = off == null ? '' : `, bow ${off.toFixed(0)}° off the wind`;
        if (hs.stdDeg >= opts.swingMinDeg && intoWind) {
          accepted = true;
          reason = `swinging (heading σ ${hs.stdDeg.toFixed(1)}°${offTxt})`;
        } else {
          accepted = true;
          source = 'berth';
          reason = `berth — dock/slip (heading σ ${hs.stdDeg.toFixed(1)}°${offTxt})`;
        }
      }
    }
    return {
      start: st.start,
      end,
      lat,
      lon,
      source,
      accepted,
      undecided,
      reason,
      headingStd: hd.length ? hs.stdDeg : null,
      positions: st.pts,
    };
  });
}

function nearestVal(sorted, t, slack) {
  let lo = 0;
  let hi = sorted.length - 1;
  if (hi < 0) return null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  let best = null;
  for (const i of [lo - 1, lo]) {
    const s = sorted[i];
    if (s && Math.abs(s.t - t) <= slack && (!best || Math.abs(s.t - t) < Math.abs(best.t - t))) best = s;
  }
  return best ? best.v : null;
}

/** Sparse counts: { "bin,sector": n } — 216 cells are mostly zero. */
function sparse(counts) {
  const out = {};
  counts.forEach((row, b) =>
    row.forEach((c, s) => {
      if (c) out[`${b},${s}`] = c;
    }),
  );
  return out;
}

export function dense(sp) {
  const counts = emptyCounts();
  for (const [k, c] of Object.entries(sp || {})) {
    const [b, s] = k.split(',').map(Number);
    if (counts[b] && s >= 0 && s < counts[b].length) counts[b][s] += Number(c) || 0;
  }
  return counts;
}

/**
 * Hour rows for accepted stays. Hour is the idempotent unit: the store
 * upserts by hour start, so recomputing an overlapping window never
 * double-counts.
 */
export function hourRows(series, stays) {
  const twd = series.get('sensor.nmea_twd') || [];
  const aws = series.get('sensor.nmea_aws') || [];
  const gust = series.get('sensor.nmea_aws_gust') || [];
  const heading = series.get('sensor.nmea_heading_true') || [];
  const rows = [];
  for (const st of stays) {
    if (!st.accepted) continue;
    for (let h = Math.floor(st.start / HOUR) * HOUR; h < st.end; h += HOUR) {
      const a = Math.max(h, st.start);
      const b = Math.min(h + HOUR, st.end);
      const counts = emptyCounts();
      let n = 0;
      let calm = 0;
      let sin = 0;
      let cos = 0;
      let maxKn = 0;
      for (const p of inRange(twd, a, b)) {
        const speed = nearestVal(aws, p.t, MIN);
        if (speed == null) continue;
        n += 1;
        maxKn = Math.max(maxKn, speed);
        if (speed < CALM_MAX) {
          calm += 1;
          continue;
        }
        sin += Math.sin(rad(p.v));
        cos += Math.cos(rad(p.v));
        const bi = BINS.findIndex((x) => x.id === binOf(speed).id);
        counts[bi][sectorOf(p.v)] += 1;
      }
      for (const g of inRange(gust, a, b)) maxKn = Math.max(maxKn, g.v);
      let hSin = 0;
      let hCos = 0;
      for (const hp of inRange(heading, a, b)) {
        hSin += Math.sin(rad(hp.v));
        hCos += Math.cos(rad(hp.v));
      }
      const ps = inRange(st.positions, a, b);
      rows.push({
        hour: new Date(h).toISOString(),
        stayStart: new Date(st.start).toISOString(),
        lat: st.lat,
        lon: st.lon,
        source: st.source,
        minutes: Math.round((b - a) / MIN),
        n,
        calm,
        counts: sparse(counts),
        sin,
        cos,
        maxKn: Math.round(maxKn * 10) / 10,
        hSin,
        hCos,
        swingM: Math.round(quantile(ps.map((q) => distM(q.lat, q.lon, st.lat, st.lon)), 0.9)),
      });
    }
  }
  return rows;
}

/** Spot summary from its hour rows (all belong to one spot). */
export function spotSummary(id, rows) {
  const live = rows.filter((r) => r.minutes > 0);
  const minutes = live.reduce((s, r) => s + r.minutes, 0) || 1;
  const lat = live.reduce((s, r) => s + r.lat * r.minutes, 0) / minutes;
  const lon = live.reduce((s, r) => s + r.lon * r.minutes, 0) / minutes;
  const counts = emptyCounts();
  let n = 0;
  let calm = 0;
  let sin = 0;
  let cos = 0;
  let maxKn = 0;
  let hSin = 0;
  let hCos = 0;
  for (const r of live) {
    hSin += r.hSin || 0;
    hCos += r.hCos || 0;
    const d = dense(r.counts);
    d.forEach((row, b) => row.forEach((c, s) => (counts[b][s] += c)));
    n += r.n;
    calm += r.calm;
    sin += r.sin;
    cos += r.cos;
    maxKn = Math.max(maxKn, r.maxKn || 0);
  }
  const windy = n - calm;
  const hours = live.map((r) => r.hour).sort();
  return {
    id,
    geohash: encodeGeohash(lat, lon, 8),
    lat,
    lon,
    minutes,
    // Runs of back-to-back hours, not distinct stayStart: each cycle sees a
    // long stay cut off at its window start, so stayStart is not stable.
    visits: hours.filter((h, i) => i === 0 || Date.parse(h) - Date.parse(hours[i - 1]) > HOUR).length,
    firstSeen: hours[0] || null,
    lastSeen: live.length ? new Date(Date.parse(hours[hours.length - 1]) + HOUR).toISOString() : null,
    // Mean resultant length of non-calm TWD: 1 = always the same direction,
    // → 0 = wind (and the boat) all over the place.
    steadiness: windy > 0 ? Math.sqrt(sin * sin + cos * cos) / windy : null,
    swingM: Math.round(live.reduce((s, r) => s + (r.swingM || 0) * r.minutes, 0) / minutes),
    maxKn,
    sources: [...new Set(live.map((r) => r.source))],
    kind: live.length && live.every((r) => r.source === 'berth') ? 'berth' : 'anchor',
    // Mean bow heading — fixed in a slip, so it says how the wind lies on the boat.
    headingDeg: hSin || hCos ? Math.round(((Math.atan2(hSin, hCos) * 180) / Math.PI + 360) % 360) : null,
    ...toRose(counts, calm, n),
  };
}
