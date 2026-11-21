/**
 * Operator-supplied Poseidon load/detail model. The profile is data beside
 * the archive (`zoom-profile.json`) and never required: an absent or invalid
 * file keeps the style minzoom table and the hard per-chart caps below.
 */

export type PoseidonDetailBand = 'overview' | 'coastal' | 'approach' | 'harbor';

export type PoseidonZoomProfileEntry = {
  minzoom: number;
  maxzoom: number;
  variant?: string;
  detail?: string;
  loadMs?: number;
  p50Ms?: number;
  p95Ms?: number;
  tileBytes?: number;
  notes?: string;
};

export type PoseidonZoomProfile = {
  version: 1;
  chart: string;
  generatedAt?: string;
  entries: PoseidonZoomProfileEntry[];
};

/** The Poseidon style's own layer gates, in the order they appear. */
export const POSEIDON_STYLE_MINZOOMS = [7, 9, 10, 11, 12, 13, 14] as const;

/**
 * Hard floors that keep a normal world/overview view off a giant regional
 * archive. A profile may raise a floor, never lower it.
 */
export const POSEIDON_MINZOOM_CAPS: Record<string, number> = {
  'poseidon-nav': 10,
  'poseidon-sonar': 10,
  'poseidon-s57': 7,
  'poseidon-s57-detail': 8,
};

/** Off until the operator's timing file proves a ladder is useful. */
export const POSEIDON_LADDER_ENABLED = false;

const PROFILE_VERSION = 1;
const MISSING_TTL_MS = 30_000;
const DETAIL_BANDS: Record<string, true> = {
  overview: true,
  coastal: true,
  approach: true,
  harbor: true,
};
const CHART_SLUGS = ['poseidon-s57-detail', 'poseidon-s57', 'poseidon-nav', 'poseidon-sonar'] as const;

type LoadState = { profile: PoseidonZoomProfile | null; expiresAt: number };
const loadCache = new Map<string, LoadState>();
let active: { chart: string; profile: PoseidonZoomProfile | null } | null = null;

export function poseidonChartSlug(chart: string): string | null {
  const text = String(chart || '').toLowerCase();
  // An overview is a separate z0-8 archive; do not inherit the regional
  // chart's z10 floor or its zoom-profile.json (there is none).
  if (text.includes('-overview')) return null;
  return CHART_SLUGS.find((slug) => text.includes(slug)) ?? null;
}

export function minzoomCapForChart(chart: string): number {
  const slug = poseidonChartSlug(chart);
  return slug ? POSEIDON_MINZOOM_CAPS[slug] ?? 0 : 0;
}

function finiteZoom(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 24 ? n : null;
}

function optionalNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Validate and normalise an operator file. Invalid entries are not guessed. */
export function normalizePoseidonZoomProfile(raw: unknown, chart: string): PoseidonZoomProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const doc = raw as Record<string, unknown>;
  if (doc.version !== PROFILE_VERSION || typeof doc.chart !== 'string') return null;
  if (poseidonChartSlug(doc.chart) !== poseidonChartSlug(chart)) return null;
  if (!Array.isArray(doc.entries) || doc.entries.length === 0) return null;
  const entries: PoseidonZoomProfileEntry[] = [];
  for (const item of doc.entries) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const minzoom = finiteZoom(row.minzoom);
    const maxzoom = finiteZoom(row.maxzoom);
    if (minzoom == null || maxzoom == null || minzoom > maxzoom) return null;
    entries.push({
      minzoom,
      maxzoom,
      variant: optionalString(row.variant),
      detail: optionalString(row.detail),
      loadMs: optionalNumber(row.loadMs),
      p50Ms: optionalNumber(row.p50Ms),
      p95Ms: optionalNumber(row.p95Ms),
      tileBytes: optionalNumber(row.tileBytes),
      notes: optionalString(row.notes),
    });
  }
  entries.sort((a, b) => a.minzoom - b.minzoom || a.maxzoom - b.maxzoom);
  return {
    version: PROFILE_VERSION,
    chart: doc.chart,
    generatedAt: optionalString(doc.generatedAt),
    entries,
  };
}

/** The fallback is the published style table, not a guessed load model. */
export function fallbackPoseidonProfile(chart: string): PoseidonZoomProfile {
  return {
    version: PROFILE_VERSION,
    chart,
    entries: POSEIDON_STYLE_MINZOOMS.map((z) => ({
      minzoom: z,
      maxzoom: z,
      variant: 'style',
      detail: 'style',
    })),
  };
}

export function poseidonProfileEntryAt(
  profile: PoseidonZoomProfile | null,
  zoom: number,
): PoseidonZoomProfileEntry | null {
  if (!profile) return null;
  let best: PoseidonZoomProfileEntry | null = null;
  for (const entry of profile.entries) {
    if (zoom < entry.minzoom || zoom > entry.maxzoom) continue;
    if (!best || entry.minzoom > best.minzoom) best = entry;
  }
  return best;
}

/** Detail band from the profile when valid; otherwise the default bands apply. */
export function profileDetailAt(profile: PoseidonZoomProfile | null, zoom: number): PoseidonDetailBand | null {
  const detail = poseidonProfileEntryAt(profile, zoom)?.detail;
  return detail && Object.hasOwn(DETAIL_BANDS, detail) ? (detail as PoseidonDetailBand) : null;
}

/** A profile may raise a chart's floor, never go below the hard cap. */
export function poseidonMinZoom(chart: string, profile: PoseidonZoomProfile | null): number {
  const cap = minzoomCapForChart(chart);
  if (!profile?.entries.length) return cap;
  const floor = Math.min(...profile.entries.map((entry) => entry.minzoom));
  return Math.max(cap, floor);
}

/** The optional ladder is deliberately off. Kept data-driven for later. */
export function poseidonLadderAt(
  profile: PoseidonZoomProfile | null,
  zoom: number,
): { variant: string; detail?: string } | null {
  const ladderEnabled: boolean = POSEIDON_LADDER_ENABLED;
  if (!ladderEnabled) return null;
  const entry = poseidonProfileEntryAt(profile, zoom);
  return entry?.variant ? { variant: entry.variant, detail: entry.detail } : null;
}

export function profileUrl(tilesetId: string, rev: string): string {
  const base = `/api/chartbundle/${encodeURIComponent(tilesetId)}/zoom-profile.json`;
  return `${base}?v=${encodeURIComponent(rev)}`;
}

/**
 * Fetch once per archive revision. A missing/invalid file is retried after
 * 30 s so a newly copied profile can appear without a rebuild. Network or
 * JSON failure is never allowed to fail the map.
 */
export async function loadPoseidonZoomProfile(
  tilesetId: string,
  rev: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PoseidonZoomProfile | null> {
  const key = `${tilesetId}:${rev}`;
  const hit = loadCache.get(key);
  if (hit && (hit.profile || hit.expiresAt > Date.now())) return hit.profile;
  let profile: PoseidonZoomProfile | null = null;
  try {
    const res = await fetchImpl(profileUrl(tilesetId, rev), { cache: 'no-store' });
    if (res.ok) profile = normalizePoseidonZoomProfile(await res.json(), tilesetId);
  } catch {
    profile = null;
  }
  loadCache.set(key, {
    profile,
    expiresAt: profile ? Number.POSITIVE_INFINITY : Date.now() + MISSING_TTL_MS,
  });
  return profile;
}

/** The profile painted most recently, for the zoom-aware detail UI. */
export function setActivePoseidonProfile(chart: string, profile: PoseidonZoomProfile | null): void {
  active = { chart, profile };
}

export function getActivePoseidonProfile(): PoseidonZoomProfile | null {
  return active?.profile ?? null;
}

export function activePoseidonChart(): string | null {
  return active?.chart ?? null;
}

/** Human-readable fallback line for the Nautical chart section. */
export function poseidonMinZoomLabel(chart: string, profile: PoseidonZoomProfile | null): string {
  const z = poseidonMinZoom(chart, profile);
  return z > 0 ? `z${z}+` : 'all zooms';
}
