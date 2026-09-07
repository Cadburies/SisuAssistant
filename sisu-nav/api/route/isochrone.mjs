import {
  bearingDeg,
  destPoint,
  haversineNm,
  twaAbs,
} from './geo.mjs';
import { crossesLand, onLand, snapToWater } from './land.mjs';

export const MODES = [
  { id: 'eta', label: 'Minimize ETA' },
  { id: 'modelAgreement', label: 'Prefer multi-model agreement' },
  { id: 'ensembleAgreement', label: 'Prefer ensemble-member agreement' },
];

function windForMode(sample, mode) {
  if (mode === 'modelAgreement') {
    return {
      tws: sample.modelTws ?? sample.tws,
      twd: sample.modelTwd ?? sample.twd,
      spread: sample.modelSpread ?? 0,
    };
  }
  return {
    tws: sample.tws,
    twd: sample.twd,
    spread: mode === 'ensembleAgreement' ? sample.ensSpread ?? 0 : 0,
  };
}

function penalize(bsp, spread, mode) {
  if (mode === 'eta' || !spread) return bsp;
  return bsp * (1 - 0.7 * spread);
}

function prune(points, start, dest, bins = 48) {
  const best = new Array(bins).fill(null);
  let closest = null;
  for (const p of points) {
    const brg = bearingDeg(start, p);
    const i = Math.floor(((brg + 360) % 360) / (360 / bins)) % bins;
    const toDest = haversineNm(p, dest);
    const score = -toDest;
    if (!best[i] || score > best[i].score) best[i] = { ...p, score };
    if (!closest || toDest < closest.toDest) closest = { ...p, toDest };
  }
  const out = best.filter(Boolean);
  if (closest && !out.some((p) => p.lat === closest.lat && p.lon === closest.lon)) {
    out.push(closest);
  }
  return out;
}

function reconstruct(nodes, idx) {
  const coords = [];
  let i = idx;
  const guard = new Set();
  while (i >= 0 && !guard.has(i)) {
    guard.add(i);
    const n = nodes[i];
    coords.push([n.lon, n.lat]);
    i = n.parent;
  }
  coords.reverse();
  return coords;
}

export function planIsochrone({ start, dest, polar, wind, mode, maxTws, maxHs, dtHours, maxHours }) {
  const s0 = snapToWater(start, dest);
  const d0 = snapToWater(dest, start);
  if (s0.landlocked) throw Object.assign(new Error('start is landlocked'), { status: 400 });
  if (d0.landlocked) throw Object.assign(new Error('destination is landlocked'), { status: 400 });

  const rangeNm = haversineNm(s0, d0);
  const dt = dtHours || (rangeNm < 80 ? 0.5 : 1);
  const cap = maxHours || Math.min(72, Math.max(12, rangeNm / 2 + 8));
  const arriveNm = Math.max(1.2, Math.min(4, rangeNm * 0.06));
  const hdgs = [];
  for (let h = 0; h < 360; h += 15) hdgs.push(h);

  const origin = { lat: s0.lat, lon: s0.lon, tHours: 0, parent: -1, idx: 0 };
  const nodes = [origin];
  let frontier = [origin];
  const isochrones = [];
  let hit = null;
  const steps = Math.ceil(cap / dt);

  for (let step = 0; step < steps; step++) {
    const next = [];
    for (const p of frontier) {
      const sample = wind.sample(p.lat, p.lon, p.tHours);
      if (!sample || sample.tws == null) continue;
      const w = windForMode(sample, mode);
      if (w.tws == null) continue;
      if (maxTws != null && w.tws > maxTws) continue;
      if (maxHs != null && sample.hs != null && sample.hs > maxHs) continue;
      const parentIdx = p.idx;
      for (const hdg of hdgs) {
        const twa = twaAbs(hdg, w.twd);
        let bsp = polar.bsp(twa, w.tws);
        bsp = penalize(bsp, w.spread, mode);
        if (bsp < 0.45) continue;
        const np = destPoint(p, hdg, bsp * dt);
        if (onLand(np) || crossesLand(p, np)) continue;
        const node = {
          lat: np.lat,
          lon: np.lon,
          tHours: p.tHours + dt,
          parent: parentIdx,
          heading: hdg,
        };
        next.push(node);
        const dnm = haversineNm(node, d0);
        if (dnm <= arriveNm && (!hit || node.tHours < hit.tHours)) {
          node.idx = nodes.length;
          nodes.push(node);
          hit = node;
        }
      }
    }
    if (hit) break;
    if (!next.length) break;
    const kept = prune(next, s0, d0);
    for (const n of kept) {
      n.idx = nodes.length;
      nodes.push(n);
    }
    frontier = kept;
    if (step % 2 === 1 || step === 0) {
      isochrones.push({
        tHours: kept[0]?.tHours ?? (step + 1) * dt,
        coordinates: kept.map((p) => [p.lon, p.lat]),
      });
    }
  }

  if (!hit) {
    let best = frontier[0] || origin;
    let bestD = Infinity;
    for (const p of frontier) {
      const d = haversineNm(p, d0);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    hit = best;
  }

  const hitIdx = hit.idx ?? 0;
  let coords = reconstruct(nodes, hitIdx);
  if (coords.length && haversineNm({ lat: hit.lat, lon: hit.lon }, d0) < 8) {
    const last = { lat: hit.lat, lon: hit.lon };
    if (!crossesLand(last, d0) && !onLand(d0)) {
      coords = [...coords, [d0.lon, d0.lat]];
    }
  }
  if (coords.length < 2) coords = [[s0.lon, s0.lat], [d0.lon, d0.lat]];

  let distNm = 0;
  for (let i = 1; i < coords.length; i++) {
    distNm += haversineNm(
      { lon: coords[i - 1][0], lat: coords[i - 1][1] },
      { lon: coords[i][0], lat: coords[i][1] },
    );
  }

  return {
    start: s0,
    dest: d0,
    coordinates: coords,
    distanceNm: distNm,
    etaHours: hit?.tHours ?? distNm / 5,
    isochrones,
    arrived: haversineNm({ lat: hit.lat, lon: hit.lon }, d0) <= arriveNm + 0.5,
    dtHours: dt,
    maxHours: cap,
  };
}

function sampleAlong(wind, coords, tHours, keyFn) {
  if (!coords.length) return null;
  const i = Math.min(coords.length - 1, Math.max(0, Math.round((tHours / 48) * (coords.length - 1))));
  const [lon, lat] = coords[i];
  const s = wind.sample(lat, lon, tHours);
  return s ? keyFn(s) : null;
}

export function evaluateMembers({ wind, polar, coords, mode, maxTws, maxHs }) {
  const used = wind.usedMembers || [];
  const etas = [];
  const p90s = [];
  for (const key of used) {
    let t = 0;
    let ok = true;
    for (let i = 1; i < coords.length; i++) {
      const a = { lon: coords[i - 1][0], lat: coords[i - 1][1] };
      const b = { lon: coords[i][0], lat: coords[i][1] };
      const dnm = haversineNm(a, b);
      const s = wind.sample(a.lat, a.lon, t);
      const member = s?.members?.[key];
      const tws = member?.tws ?? s?.tws;
      const twd = member?.twd ?? s?.twd;
      if (tws == null || twd == null) {
        ok = false;
        break;
      }
      if (maxTws != null && tws > maxTws) {
        ok = false;
        break;
      }
      if (maxHs != null && s.hs != null && s.hs > maxHs) {
        ok = false;
        break;
      }
      const brg = bearingDeg(a, b);
      const bsp = polar.bsp(twaAbs(brg, twd), tws);
      if (bsp < 0.4) {
        ok = false;
        break;
      }
      t += dnm / bsp;
    }
    if (ok) etas.push({ member: key, hours: t });
  }
  const n = Math.max(8, coords.length);
  for (let k = 0; k < n; k++) {
    const tHours = (k / Math.max(1, n - 1)) * (etas[0]?.hours || 6);
    const s = sampleAlong(wind, coords, tHours, (x) => x.p90Tws);
    if (s != null) p90s.push(s);
  }
  const hours = etas.map((e) => e.hours).sort((a, b) => a - b);
  const histogram = histogramOf(hours);
  return {
    members: etas,
    histogram,
    p90Tws: p90s.length ? Math.max(...p90s) : null,
    etaP50: hours.length ? hours[Math.floor(hours.length / 2)] : null,
  };
}

function histogramOf(hours) {
  if (!hours.length) return [];
  const lo = hours[0];
  const hi = hours[hours.length - 1];
  const width = Math.max(0.5, (hi - lo) / 6);
  const bins = [];
  for (let x = lo; x <= hi + 1e-6; x += width) {
    bins.push({ hours: Number(x.toFixed(2)), count: 0 });
  }
  for (const h of hours) {
    const i = Math.min(bins.length - 1, Math.floor((h - lo) / width));
    bins[i].count += 1;
  }
  return bins;
}

export { windForMode };
