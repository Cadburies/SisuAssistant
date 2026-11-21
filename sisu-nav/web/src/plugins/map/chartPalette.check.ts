/**
 * Palette + derived theme checks. Run:
 *   node --experimental-strip-types src/plugins/map/chartPalette.check.ts
 * from sisu-nav/web. Not imported by the app.
 */
import {
  CHART,
  bathyWidth,
  contourWidth,
  depthFill,
  depthFillExpression,
  lineDash,
  mixHex,
  contrastRatio,
  nightInk,
} from './chartPalette.ts';
import { deriveTokens, extractPalette, themeContrast } from './poseidonTheme.ts';

function fail(msg: string): never {
  throw new Error(msg);
}

if (CHART.land !== '#C65D00' || CHART.cable !== '#C800A0' || CHART.hazard !== '#ff2600') {
  fail('chart tokens drifted from the Poseidon export');
}
if (depthFill(0) !== '#8E1B1B') fail(`shallow depth fill ${depthFill(0)}`);
if (depthFill(1.99) !== '#EF6F6C') fail(`just-under-2 m depth fill ${depthFill(1.99)}`);
if (depthFill(2) !== '#0E9AA7') fail(`2 m depth fill ${depthFill(2)}`);
if (depthFill(20) !== '#93E2DC') fail(`20 m depth fill ${depthFill(20)}`);
if (depthFill(100) !== '#E3F7F5') fail(`deep depth fill ${depthFill(100)}`);
if (!Array.isArray(depthFillExpression()) || depthFillExpression()[0] !== 'case') fail('depth expression');
if (contourWidth(8) !== 0.5 || contourWidth(16) !== 1.2) fail('contour width');
if (bathyWidth(8) !== 0.35 || bathyWidth(16) !== 0.8) fail('bathy width');
if (mixHex('#000000', '#ffffff', 0.5) !== '#808080') fail('mix');
if (contrastRatio('#000000', '#ffffff') < 20) fail('contrast');
if (JSON.stringify(lineDash('dashed')) !== JSON.stringify([4, 3])) fail('dashed pattern');
if (JSON.stringify(lineDash('long-dash')) !== JSON.stringify([10, 4])) fail('long-dash pattern');
if (nightInk('#000000') === '#000000') fail('night ink did not lift');

const style = {
  layers: [
    { id: 'nv-land-fill', type: 'fill', paint: { 'fill-color': '#C65D00' } },
    {
      id: 'nv-depth-area',
      type: 'fill',
      paint: { 'fill-color': ['case', ['<', ['get', 'depth'], 2], '#8E1B1B', '#0E9AA7'] },
    },
    { id: 'nv-hazard-rock-point', type: 'circle', paint: { 'circle-color': '#ff2600' } },
    {
      id: 'nv-light-sector-arc',
      type: 'line',
      paint: { 'line-color': ['match', ['get', 'light_colour'], 'W', '#F2C200', '#A0007A'] },
    },
  ],
};

const palette = extractPalette(style);
if (palette.land !== '#C65D00') fail(`land ${palette.land}`);
if (palette.sea !== '#0E9AA7') fail(`sea ${palette.sea}`);
if (palette.hazard !== '#FF2600') fail(`hazard ${palette.hazard}`);
if (palette.light !== '#F2C200') fail(`light ${palette.light}`);
if (palette.wait !== palette.light) fail('warning colour did not follow the light sector');
if (palette.ok !== '#1E9E3A') fail(`success colour ${palette.ok}`);

const overridden = extractPalette(style, { types: { 'nv-land-fill': { color: '#B34D00' } } });
if (overridden.land !== '#B34D00') fail(`style-colors override ${overridden.land}`);

for (const mode of ['dark', 'light'] as const) {
  const tokens = deriveTokens(palette, mode);
  const c = themeContrast(tokens);
  if (c.text < 6.5) fail(`${mode} text contrast ${c.text}`);
  if (c.muted < 4.4) fail(`${mode} muted contrast ${c.muted}`);
  if (c.accent < 4.4) fail(`${mode} accent contrast ${c.accent}`);
  if (tokens['--gold'] === tokens['--cyan']) fail(`${mode} accents collapsed`);
  if (tokens['--bg'] === tokens['--text']) fail(`${mode} surface equals ink`);
}

console.log('chartPalette.check ok');
