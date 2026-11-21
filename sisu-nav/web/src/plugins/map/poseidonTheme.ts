/**
 * Derive the cockpit UI theme from a Poseidon chart export (#252).
 *
 * The operator tunes colours in Poseidon. This module reads the selected (or
 * first available) bundle, takes land / sea / hazard / light colours, and
 * produces the CSS token map for day and night. The chart colours themselves
 * stay exact; only UI surfaces, ink and accents are derived.
 *
 * A missing or unreadable bundle leaves the static App.css tokens in place —
 * the app never fails because a chart is absent.
 */

import {
  CHART,
  WX,
  adjustForContrast,
  contrastRatio,
  hexToRgb,
  mixHex,
  rgbToHsl,
  type ThemeMode,
} from './chartPalette.ts';

export type PoseidonPalette = {
  land: string;
  sea: string;
  hazard: string;
  light: string;
  ok: string;
  wait: string;
};

export type ThemeTokens = Record<string, string>;

type Json = Record<string, unknown>;

function isObj(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function layer(style: unknown, id: string): Json | null {
  if (!isObj(style) || !Array.isArray(style.layers)) return null;
  for (const item of style.layers) {
    if (isObj(item) && item.id === id) return item;
  }
  return null;
}

function paintOf(style: unknown, id: string): Json | null {
  const hit = layer(style, id);
  return hit && isObj(hit.paint) ? hit.paint : null;
}

function collectHex(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) out.push(value.toUpperCase());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHex(item, out);
    return;
  }
  if (isObj(value)) {
    for (const item of Object.values(value)) collectHex(item, out);
  }
}

function colorsOf(style: unknown, id: string, prop: string): string[] {
  const paint = paintOf(style, id);
  if (!paint) return [];
  const out: string[] = [];
  collectHex(paint[prop], out);
  return out;
}

function firstColor(colors: string[]): string | null {
  return colors.length ? colors[0] : null;
}

function bestHue(colors: string[], min: number, max: number): string | null {
  let best: string | null = null;
  let score = -1;
  for (const color of colors) {
    const [h, s, l] = rgbToHsl(color);
    if (h < min || h > max) continue;
    const fit = s * (1 - Math.abs(l - 0.45));
    if (fit > score) {
      best = color;
      score = fit;
    }
  }
  return best;
}

/** Type overrides in `style-colors.json` win over the style's own paint. */
function overrideColor(colors: unknown, id: string): string | null {
  if (!isObj(colors) || !isObj(colors.types)) return null;
  const spec = colors.types[id];
  if (!isObj(spec)) return null;
  return typeof spec.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(spec.color) ? spec.color.toUpperCase() : null;
}

export function extractPalette(style: unknown, styleColors?: unknown): PoseidonPalette {
  const land =
    overrideColor(styleColors, 'nv-land-fill') ||
    firstColor(colorsOf(style, 'nv-land-fill', 'fill-color')) ||
    firstColor(colorsOf(style, 'nv-base-area', 'fill-color')) ||
    CHART.land;

  const depthColors = colorsOf(style, 'nv-depth-area', 'fill-color');
  const sea =
    overrideColor(styleColors, 'nv-depth-area') ||
    bestHue(depthColors, 160, 215) ||
    CHART.depthDeepLow;

  const hazard =
    overrideColor(styleColors, 'nv-hazard-rock-point') ||
    firstColor(colorsOf(style, 'nv-hazard-rock-point', 'circle-color')) ||
    firstColor(colorsOf(style, 'nv-hazard-rock', 'line-color')) ||
    CHART.hazard;

  const lightColors = colorsOf(style, 'nv-light-sector-arc', 'line-color');
  const light =
    overrideColor(styleColors, 'nv-light-sector-arc') ||
    firstColor(lightColors) ||
    CHART.lightWhiteYellow;
  const ok = bestHue(lightColors, 90, 170) || CHART.lightGreen;

  return {
    land,
    sea,
    hazard,
    light,
    ok,
    wait: light,
  };
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function glow(hex: string, mode: ThemeMode): string {
  if (mode === 'light') {
    return `0 0 0 1px ${hex}, 0 0 6px ${rgba(hex, 0.35)}`;
  }
  return `0 0 1px ${hex}, 0 0 10px ${rgba(hex, 0.55)}, 0 0 22px ${rgba(hex, 0.22)}`;
}

/**
 * Pure token derivation. Exported for the check file; no DOM access.
 * Night keeps the Poseidon hues and lifts ink/accent lightness. Day darkens
 * the same hues for contrast on a light surface. No hue swap.
 */
export function deriveTokens(palette: PoseidonPalette, mode: ThemeMode): ThemeTokens {
  const sea = palette.sea;
  const panelSolid = mode === 'dark' ? mixHex(sea, '#000000', 0.82) : '#ffffff';
  const bg = mode === 'dark' ? mixHex(sea, '#000000', 0.92) : mixHex(sea, '#ffffff', 0.92);
  const well = mode === 'dark' ? mixHex(sea, '#000000', 0.9) : '#ffffff';
  const well2 = mode === 'dark' ? mixHex(sea, '#000000', 0.84) : mixHex(sea, '#ffffff', 0.96);
  const statusbar = mode === 'dark' ? mixHex(sea, '#000000', 0.88) : mixHex(sea, '#ffffff', 0.88);

  const textBase = mode === 'dark' ? mixHex(sea, '#ffffff', 0.9) : mixHex(sea, '#000000', 0.82);
  const text = adjustForContrast(textBase, bg, mode === 'dark' ? 7 : 7, mode === 'dark' ? 'lighten' : 'darken');
  const muted = adjustForContrast(
    mixHex(text, panelSolid, mode === 'dark' ? 0.5 : 0.3),
    panelSolid,
    4.5,
    mode === 'dark' ? 'lighten' : 'darken',
  );
  const line = mixHex(text, panelSolid, mode === 'dark' ? 0.78 : 0.8);

  const direction = mode === 'dark' ? 'lighten' : 'darken';
  const accent = adjustForContrast(palette.land, panelSolid, 4.5, direction);
  const cyan = adjustForContrast(sea, panelSolid, 4.5, direction);
  const red = adjustForContrast(palette.hazard, panelSolid, 4.5, direction);
  const ok = adjustForContrast(palette.ok, panelSolid, 4.5, direction);
  const wait = adjustForContrast(palette.wait, panelSolid, 4.5, direction);

  return {
    '--bg': bg,
    '--panel': mode === 'dark' ? `${panelSolid}ee` : '#ffffffee',
    '--well': well,
    '--well-2': well2,
    '--statusbar': statusbar,
    '--line': line,
    '--text': text,
    '--muted': muted,
    '--gold': accent,
    '--cyan': cyan,
    '--red': red,
    '--ok': ok,
    '--wait': wait,
    '--glow-gold': glow(accent, mode),
    '--glow-cyan': glow(cyan, mode),
    '--glow-red': glow(red, mode),
    '--glow-ok': glow(ok, mode),
    '--wx-wave-ramp': `linear-gradient(90deg, ${WX.currentSlow}, ${WX.waveCombined}, ${WX.waveWindSea}, ${WX.waveRough}, ${WX.heatHigh}, ${WX.waveExtreme})`,
    '--wx-current-ramp': `linear-gradient(90deg, ${WX.currentSlow}, ${WX.currentMod}, ${WX.currentFast}, ${WX.waveRough}, ${WX.currentJet})`,
    '--wx-spread-ramp': `linear-gradient(90deg, ${WX.heatLow}, ${WX.heatMid}, ${WX.heatHigh})`,
  };
}

type Tileset = {
  id?: string;
  file?: string;
  kind?: string;
  provider?: string | null;
  providerLabel?: string | null;
};

type Derived = { dark: ThemeTokens; light: ThemeTokens; source: string };

let derived: Derived | null = null;
let currentMode: ThemeMode = 'dark';
let started: Promise<boolean> | null = null;

function apply(mode: ThemeMode): void {
  if (!derived) return;
  const tokens = mode === 'dark' ? derived.dark : derived.light;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) root.style.setProperty(key, value);
  root.dataset.poseidonTheme = 'derived';
}

/** theme.ts calls this on every mode change; a later load re-applies the mode. */
export function applyPoseidonTheme(mode: ThemeMode): void {
  currentMode = mode;
  apply(mode);
}

function candidateScore(ts: Tileset): number {
  const text = `${ts.file || ''} ${ts.provider || ''} ${ts.providerLabel || ''}`.toLowerCase();
  if (text.includes('poseidon-nav')) return 0;
  if (text.includes('poseidon-sonar')) return 1;
  if (text.includes('poseidon-s57-detail')) return 2;
  if (text.includes('poseidon-s57')) return 3;
  if (text.includes('poseidon')) return 4;
  return -1;
}

async function load(): Promise<boolean> {
  let tilesets: Tileset[] = [];
  try {
    const res = await fetch('/api/tilesets', { cache: 'no-store' });
    if (!res.ok) return false;
    const body = (await res.json()) as { tilesets?: Tileset[] };
    tilesets = Array.isArray(body.tilesets) ? body.tilesets : [];
  } catch {
    return false;
  }

  const candidates = tilesets
    .filter((ts) => ts.id && candidateScore(ts) >= 0)
    .sort((a, b) => candidateScore(a) - candidateScore(b));

  for (const ts of candidates) {
    if (!ts.id) continue;
    const base = `/api/chartbundle/${encodeURIComponent(ts.id)}`;
    let style: unknown;
    try {
      const res = await fetch(`${base}/style`, { cache: 'no-store' });
      if (!res.ok) continue;
      style = await res.json();
    } catch {
      continue;
    }
    let styleColors: unknown;
    try {
      const res = await fetch(`${base}/style-colors.json`, { cache: 'no-store' });
      if (res.ok) styleColors = await res.json();
    } catch {
      /* optional */
    }
    const palette = extractPalette(style, styleColors);
    derived = {
      dark: deriveTokens(palette, 'dark'),
      light: deriveTokens(palette, 'light'),
      source: ts.id,
    };
    apply(currentMode);
    return true;
  }
  return false;
}

/** Load once at boot. Failures keep the static App.css palette. */
export function initPoseidonTheme(): Promise<boolean> {
  if (!started) {
    started = load().catch(() => false);
  }
  return started;
}

/** Re-read the export after the operator changes Poseidon colours. */
export function refreshPoseidonTheme(): Promise<boolean> {
  started = load().catch(() => false);
  return started;
}

export function poseidonThemeSource(): string | null {
  return derived?.source ?? null;
}

/** Check helper: verify the derived ink is actually readable. */
export function themeContrast(tokens: ThemeTokens): { text: number; muted: number; accent: number } {
  const panel = tokens['--panel'].slice(0, 7);
  return {
    text: contrastRatio(tokens['--text'], panel),
    muted: contrastRatio(tokens['--muted'], panel),
    accent: contrastRatio(tokens['--gold'], panel),
  };
}
