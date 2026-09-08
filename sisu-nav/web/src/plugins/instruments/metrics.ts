import type { SignalKSnapshot } from '../../app/sk';
import { fmtLat, fmtLon, skAngleDeg, skSpeedKn, wrapDeg } from '../../app/units';

export type MetricId =
  | 'aws'
  | 'awa'
  | 'tws'
  | 'twa'
  | 'twd'
  | 'sog'
  | 'cog'
  | 'hdg'
  | 'lat'
  | 'lon';

export type MetricDef = {
  id: MetricId;
  label: string;
  format: (sk: SignalKSnapshot) => string;
};

function signedAwa(deg: number): number {
  const w = wrapDeg(deg);
  return w > 180 ? w - 360 : w;
}

function fmtAwa(deg: number | undefined): string {
  if (deg == null) return '—';
  const s = signedAwa(deg);
  const side = s > 0 ? 'S' : s < 0 ? 'P' : '';
  return `${Math.abs(s).toFixed(0)}°${side}`;
}

function kn(ms: number | undefined): string {
  const v = skSpeedKn(ms);
  return v == null ? '—' : `${v.toFixed(1)} kn`;
}

function deg(rad: number | undefined): string {
  const v = skAngleDeg(rad);
  return v == null ? '—' : `${v.toFixed(0)}°`;
}

const CATALOG: MetricDef[] = [
  { id: 'aws', label: 'AWS', format: (sk) => kn(sk.wind.aws) },
  { id: 'awa', label: 'AWA', format: (sk) => fmtAwa(skAngleDeg(sk.wind.awa)) },
  { id: 'tws', label: 'TWS', format: (sk) => kn(sk.wind.tws) },
  { id: 'twa', label: 'TWA', format: (sk) => fmtAwa(skAngleDeg(sk.wind.twa)) },
  { id: 'twd', label: 'TWD', format: (sk) => deg(sk.wind.twd) },
  { id: 'sog', label: 'SOG', format: (sk) => kn(sk.self.sog) },
  { id: 'cog', label: 'COG', format: (sk) => deg(sk.self.cog) },
  {
    id: 'hdg',
    label: 'HDG',
    format: (sk) => deg(sk.self.heading ?? sk.self.headingMag),
  },
  { id: 'lat', label: 'LAT', format: (sk) => fmtLat(sk.self.lat) },
  { id: 'lon', label: 'LON', format: (sk) => fmtLon(sk.self.lon) },
];

const byId = new Map<string, MetricDef>(CATALOG.map((m) => [m.id, m]));

/** Later issues may add metrics for new SK paths. Unknown ids stay off the picker. */
export function registerMetric(def: MetricDef): void {
  const i = CATALOG.findIndex((m) => m.id === def.id);
  if (i >= 0) CATALOG[i] = def;
  else CATALOG.push(def);
  byId.set(def.id, def);
}

export function listMetrics(): MetricDef[] {
  return CATALOG.map((m) => ({ ...m }));
}

export function getMetric(id: string | null | undefined): MetricDef | undefined {
  if (!id) return undefined;
  return byId.get(id);
}
