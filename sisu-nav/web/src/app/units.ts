export const MS_TO_KN = 1.9438444924406;

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function wrapDeg(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}

/** SK is SI (radians). Guard a few MQTT-literal degree leaks. */
export function skAngleDeg(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  if (Math.abs(value) > Math.PI * 2 + 0.2) return wrapDeg(value);
  return wrapDeg(radToDeg(value));
}

export function skSpeedKn(ms: number | undefined): number | undefined {
  if (ms == null || !Number.isFinite(ms)) return undefined;
  return ms * MS_TO_KN;
}

export function fmt(n: number | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

export function fmtLat(lat: number | undefined): string {
  if (lat == null || !Number.isFinite(lat)) return '—';
  const hemi = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(4)}°${hemi}`;
}

export function fmtLon(lon: number | undefined): string {
  if (lon == null || !Number.isFinite(lon)) return '—';
  const hemi = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lon).toFixed(4)}°${hemi}`;
}

export function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
