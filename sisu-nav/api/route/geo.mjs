/** Great-circle helpers. Distances in nautical miles. */

const R_NM = 3440.065;
const DEG = Math.PI / 180;

export function haversineNm(a, b) {
  const p1 = a.lat * DEG;
  const p2 = b.lat * DEG;
  const dp = (b.lat - a.lat) * DEG;
  const dl = (b.lon - a.lon) * DEG;
  const s =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_NM * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function bearingDeg(from, to) {
  const p1 = from.lat * DEG;
  const p2 = to.lat * DEG;
  const dl = (to.lon - from.lon) * DEG;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

export function destPoint(from, bearing, distNm) {
  const d = distNm / R_NM;
  const br = bearing * DEG;
  const p1 = from.lat * DEG;
  const l1 = from.lon * DEG;
  const p2 = Math.asin(
    Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(br),
  );
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(p1),
      Math.cos(d) - Math.sin(p1) * Math.sin(p2),
    );
  return { lat: p2 / DEG, lon: ((l2 / DEG + 540) % 360) - 180 };
}

export function twaAbs(heading, twd) {
  let a = Math.abs(heading - twd) % 360;
  if (a > 180) a = 360 - a;
  return a;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function circMean(degs) {
  if (!degs.length) return null;
  let x = 0;
  let y = 0;
  for (const d of degs) {
    x += Math.cos(d * DEG);
    y += Math.sin(d * DEG);
  }
  x /= degs.length;
  y /= degs.length;
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

export function circStd(degs) {
  if (degs.length < 2) return 0;
  const mean = circMean(degs);
  let s = 0;
  for (const d of degs) {
    let a = Math.abs(d - mean) % 360;
    if (a > 180) a = 360 - a;
    s += a * a;
  }
  return Math.sqrt(s / degs.length);
}

export function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

export function quantile(xs, q) {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const i = Math.min(a.length - 1, Math.max(0, Math.floor(q * (a.length - 1))));
  return a[i];
}

export function padBbox(start, dest, frac = 0.35, minDeg = 0.4) {
  const west = Math.min(start.lon, dest.lon);
  const east = Math.max(start.lon, dest.lon);
  const south = Math.min(start.lat, dest.lat);
  const north = Math.max(start.lat, dest.lat);
  const spanLon = Math.max(minDeg, east - west);
  const spanLat = Math.max(minDeg, north - south);
  return {
    west: west - spanLon * frac,
    south: south - spanLat * frac,
    east: east + spanLon * frac,
    north: north + spanLat * frac,
  };
}
