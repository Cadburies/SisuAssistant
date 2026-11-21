/**
 * Poseidon-derived chart palette (#252). One source for chart, overlay and
 * legend colours. The values come from the exported `style.json` and
 * `style-colors.json` beside a Poseidon archive; the UI theme derives from
 * the same land/sea/hazard colours in `poseidonTheme.ts`.
 *
 * Do not add a second palette in a plugin. Add a semantic token here.
 */

import type { ExpressionSpecification } from 'maplibre-gl';

export type ThemeMode = 'dark' | 'light';

/** Nautical-chart semantics, copied from the Poseidon export. */
export const CHART = {
  land: '#C65D00',
  landArea: '#C65D00',
  coast: '#000000',
  depthShallowLow: '#8E1B1B',
  depthShallowHigh: '#EF6F6C',
  depthDeepLow: '#0E9AA7',
  depthDeepHigh: '#93E2DC',
  depthDeepTop: '#E3F7F5',
  negativeDepth: '#8E1B1B',
  depthLine: '#7C7C7C',
  contour: '#696969',
  contourMajor: '#4C5B63',
  soundings: '#333333',
  soundingsShallow: '#000000',
  contourLabel: '#4A6A8A',
  hazard: '#ff2600',
  drying: '#C80000',
  cable: '#C800A0',
  cablePlanned: '#942192',
  cableLanding: '#8fffd2',
  restricted: '#C800A0',
  shoal: '#286EC8',
  route: '#F06EAA',
  place: '#1F5FA8',
  poiName: '#00466E',
  lightWhiteYellow: '#F2C200',
  lightRed: '#D0021B',
  lightGreen: '#1E9E3A',
  lightBlue: '#1F5FA8',
  lightOrange: '#F08A00',
  lightViolet: '#7B3FA0',
  lightAmber: '#E0A000',
  unknown: '#828282',
  unknownMagenta: '#ff40ff',
  coverage: '#E6A817',
  region: '#8D6A2F',
} as const;

/** Traffic and user-map semantics. Deliberately separate from chart colour. */
export const TRAFFIC = {
  ownBoat: '#e0b43a',
  ownBoatStroke: '#fff8e0',
  track: '#e0b43a',
  ais: '#3ec6d8',
  aisStroke: '#dff8ff',
  aisGlobal: '#c86bff',
  aisGlobalStroke: '#f3e6ff',
  here: '#fff8e0',
  hereStroke: '#e0b43a',
  note: '#3ec6d8',
  aircraft: '#f4c430',
  satellite: '#8fffd2',
} as const;

/** Weather / sea-state ramps. End colours reuse the chart hazard/accent family. */
export const WX = {
  barbAgree: '#e7eef6',
  heatLow: '#3ecf8e',
  heatMid: '#e0b43a',
  heatHigh: '#e24a4a',
  waveCombined: '#29e0ff',
  waveSwell: '#29e0ff',
  waveWindSea: '#ffc94d',
  waveRough: '#e27a3a',
  waveExtreme: '#b050c8',
  currentSlow: '#33ffb0',
  currentMod: '#29e0ff',
  currentFast: '#ffc94d',
  currentJet: '#e24a4a',
  ensembleFallback: '#8aa0b5',
  hillshadeShadow: '#6b7d8f',
  hillshadeHighlight: '#ffffff',
} as const;

/** Planned route and isochrone corridors. */
export const ROUTE = {
  active: TRAFFIC.track,
  waypoint: TRAFFIC.track,
  waypointStroke: TRAFFIC.ownBoatStroke,
  corridor: WX.heatLow,
} as const;

/** Generic map ink for labels, halos and pin strokes. */
export const MAP_INK = {
  label: '#e7eef6',
  halo: '#0b1016',
  pinStroke: '#070b10',
  white: '#ffffff',
} as const;

/** POI category colours: categorical, but anchored to the same hue family. */
export const POI = {
  marina: '#3ec6d8',
  chandlery: '#e0b43a',
  fuel: '#e07a3d',
  restaurant: '#e24a4a',
  bar: '#c084fc',
  pub: '#c084fc',
  cafe: '#f4c430',
  shop: '#7ae0a3',
  other: '#cfeaf0',
} as const;

const DEEP_TOP = CHART.depthDeepTop;

export function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '').trim();
  const full = raw.length === 3 ? raw.split('').map((c) => `${c}${c}`).join('') : raw.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0];
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const u = Math.max(0, Math.min(1, t));
  return rgbToHex([ar + (br - ar) * u, ag + (bg - ag) * u, ab + (bb - ab) * u]);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((n) => {
    const c = n / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Lighten or darken until the foreground reaches `min` against `bg`. */
export function adjustForContrast(fg: string, bg: string, min: number, direction: 'lighten' | 'darken'): string {
  let out = fg;
  const target = direction === 'lighten' ? '#ffffff' : '#000000';
  for (let i = 0; i < 32; i += 1) {
    if (contrastRatio(out, bg) >= min) return out;
    out = mixHex(out, target, 0.08);
  }
  return target;
}

export function rgbToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((n) => n / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgbToHex([(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255]);
}

/** Depth (m, positive down) → Poseidon fill. Negative is above chart datum. */
export function depthFill(depth: number): string {
  if (!Number.isFinite(depth)) return DEEP_TOP;
  if (depth < 0) return CHART.negativeDepth;
  if (depth < 2) return mixHex(CHART.depthShallowLow, CHART.depthShallowHigh, depth / 2);
  if (depth <= 20) return mixHex(CHART.depthDeepLow, CHART.depthDeepHigh, (depth - 2) / 18);
  return DEEP_TOP;
}

const GET_DEPTH = ['coalesce', ['get', 'drval1'], 100000];

/** MapLibre expression for `depare` / vector depth fills. */
export function depthFillExpression(get: unknown = GET_DEPTH): ExpressionSpecification {
  return [
    'case',
    ['<', get, 0],
    CHART.negativeDepth,
    ['<', get, 2],
    ['interpolate', ['linear'], get, 0, CHART.depthShallowLow, 2, CHART.depthShallowHigh],
    ['<', get, 20],
    ['interpolate', ['linear'], get, 2, CHART.depthDeepLow, 20, CHART.depthDeepHigh],
    DEEP_TOP,
  ] as unknown as ExpressionSpecification;
}

/** MapLibre expression for an absolute-depth raster/vector field (MapTiler ocean). */
export function oceanDepthFillExpression(get: unknown): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['abs', get],
    0,
    CHART.depthDeepLow,
    20,
    CHART.depthDeepHigh,
    200,
    DEEP_TOP,
    2000,
    DEEP_TOP,
  ] as unknown as ExpressionSpecification;
}

export function bathyWidth(zoom: number): number {
  return zoom <= 8 ? 0.35 : zoom >= 16 ? 0.8 : 0.35 + ((zoom - 8) / 8) * 0.45;
}

export function contourWidth(zoom: number): number {
  return zoom <= 8 ? 0.5 : zoom >= 16 ? 1.2 : 0.5 + ((zoom - 8) / 8) * 0.7;
}

export function coastWidth(zoom: number): number {
  return zoom <= 8 ? 0.6 : zoom >= 16 ? 1.6 : 0.6 + ((zoom - 8) / 8);
}

export function hazardRadius(zoom: number): number {
  return zoom <= 10 ? 1.2 : zoom >= 16 ? 3 : 1.2 + ((zoom - 10) / 6) * 1.8;
}

export function contourWidthExpression(): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 8, 0.5, 16, 1.2] as unknown as ExpressionSpecification;
}

export function bathyWidthExpression(): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 8, 0.35, 12, 0.55, 16, 0.8] as unknown as ExpressionSpecification;
}

export function hazardRadiusExpression(): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 10, 1.2, 16, 3] as unknown as ExpressionSpecification;
}

/** `style-colors.json` pattern names → MapLibre dash arrays. */
export function lineDash(pattern: string | undefined): number[] | undefined {
  switch (pattern) {
    case 'dashed':
      return [4, 3];
    case 'fine-dotted':
      return [0, 1.2];
    case 'long-dash':
      return [10, 4];
    case 'wavy':
      // MapLibre has no wavy stroke; a tight dash reads as a wavy cable.
      return [0, 1.5];
    default:
      return undefined;
  }
}

/** Night ink for UI text/strokes: same hue, lighter. Never use on chart fills. */
export function nightInk(hex: string): string {
  return mixHex(hex, '#ffffff', 0.25);
}

/** Day ink for UI text/strokes: same hue, darker. */
export function dayInk(hex: string): string {
  return mixHex(hex, '#000000', 0.22);
}
