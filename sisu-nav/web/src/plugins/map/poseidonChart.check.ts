/**
 * Poseidon chart style rebinding. Run:
 *   node --experimental-strip-types src/plugins/map/poseidonChart.check.ts
 * from sisu-nav/web. Not imported by the app.
 */
import {
  chartLayers,
  chartOverPhoto,
  chartToggleId,
  pickSatelliteUnderlay,
  poseidonBasePaint,
  scaleFillOpacity,
} from './poseidonChart.ts';

const style = {
  sources: { chart: { tiles: ['tiles://localhost/navionics-sonar/{z}/{x}/{y}.pbf'] } },
  layers: [
    {
      id: 'nv-land-fill',
      type: 'fill',
      source: 'chart',
      'source-layer': 'lndare',
      metadata: { 'poseidon:group': 'land' },
      paint: { 'fill-color': '#C65D00' },
    },
    {
      id: 'nv-symbol-icon',
      type: 'symbol',
      source: 'chart',
      'source-layer': 'points',
      metadata: { 'poseidon:group': 'symbols' },
      layout: { 'icon-image': 'poseidon-sym-style-96' },
    },
    { id: 'background', type: 'background' },
  ],
};

function fail(msg: string): never {
  throw new Error(msg);
}

const layers = chartLayers(style, 'local-chart', 'local-chart-', (group) => group !== 'symbols');
if (layers.length !== 2) fail(`expected 2 layers, got ${layers.length}`);
if (layers[0].source !== 'local-chart' || layers[0].id !== 'local-chart-nv-land-fill') fail('land layer was not rebound');
if (layers[0].layout?.visibility !== 'visible') fail('land should stay visible');
if (layers[1].layout?.visibility !== 'none') fail('symbols should be hidden');
if (JSON.stringify(style.sources).includes('tiles://') && layers.some((l) => JSON.stringify(l).includes('tiles://'))) {
  fail('tile URL leaked into a layer');
}
if (chartToggleId('land') !== 'chart-land' || chartToggleId('nope') !== null) fail('toggle id');
if (chartToggleId('coverage') !== 'chart-spans') fail('coverage toggle');

const baseLayers = [
  {
    id: 'land',
    type: 'fill',
    metadata: { 'poseidon:group': 'land' },
    paint: { 'fill-opacity': 0.4, 'fill-color': '#C65D00' },
  },
  {
    id: 'depth-area',
    type: 'fill',
    metadata: { 'poseidon:group': 'depth', 'poseidon:own-color': true },
    paint: { 'fill-opacity': 0.55, 'fill-color': '#0E9AA7' },
  },
  {
    id: 'depth-line',
    type: 'line',
    metadata: { 'poseidon:group': 'depth' },
    paint: { 'line-opacity': 1, 'line-color': '#000000' },
  },
];
const imagery = poseidonBasePaint(baseLayers, true);
const imageryLand = imagery[0].paint as { 'fill-opacity'?: unknown };
const imageryDepth = imagery[1].paint as { 'fill-opacity'?: unknown; 'fill-color'?: unknown };
const imageryLine = imagery[2].paint as { 'line-opacity'?: unknown };
if (imageryLand['fill-opacity'] !== 0.12) fail(`imagery land opacity ${imageryLand['fill-opacity']}`);
if (imageryDepth['fill-opacity'] !== 0.55 || imageryDepth['fill-color'] !== '#0E9AA7') {
  fail(`own-color depth fill changed: ${JSON.stringify(imageryDepth)}`);
}
if (imageryLine['line-opacity'] !== 0.7) fail(`imagery depth line opacity ${imageryLine['line-opacity']}`);
const paper = poseidonBasePaint(baseLayers, false);
const paperLand = paper[0].paint as { 'fill-opacity'?: unknown };
const paperLine = paper[2].paint as { 'line-opacity'?: unknown };
if (paperLand['fill-opacity'] !== 0.85) fail(`paper land opacity ${paperLand['fill-opacity']}`);
if (paperLine['line-opacity'] !== 1) fail(`paper depth line opacity ${paperLine['line-opacity']}`);
if (chartOverPhoto({ livePhoto: false, savedSatellite: false, satelliteUnderlay: false })) fail('plain base counted as a photo');
if (!chartOverPhoto({ livePhoto: true, savedSatellite: false, satelliteUnderlay: false })) fail('live photo was ignored');
if (!chartOverPhoto({ livePhoto: false, savedSatellite: true, satelliteUnderlay: false })) fail('saved satellite was ignored');
if (!chartOverPhoto({ livePhoto: false, savedSatellite: false, satelliteUnderlay: true })) fail('satellite underlay was ignored');

const shaded = chartLayers(
  {
    layers: [
      {
        id: 'nv-land-fill',
        type: 'fill',
        source: 'chart',
        'source-layer': 'lndare',
        paint: { 'fill-color': '#C65D00', 'fill-opacity': 0.85 },
      },
      {
        id: 'nv-depth-area',
        type: 'fill',
        source: 'chart',
        'source-layer': 'depare',
        paint: { 'fill-color': '#0E9AA7', 'fill-opacity': 0.55 },
      },
      {
        id: 'nv-land-coast',
        type: 'line',
        source: 'chart',
        'source-layer': 'lndare',
        paint: { 'line-color': '#000000', 'line-width': 1 },
      },
    ],
  },
  'src',
  'src-',
  () => true,
  0.6,
);
const land = shaded.find((l) => l.id === 'src-nv-land-fill');
const depth = shaded.find((l) => l.id === 'src-nv-depth-area');
const coast = shaded.find((l) => l.id === 'src-nv-land-coast');
const landPaint = land?.paint as { 'fill-opacity'?: unknown; 'fill-color'?: unknown } | undefined;
const depthPaint = depth?.paint as { 'fill-opacity'?: unknown } | undefined;
const coastPaint = coast?.paint as { 'line-color'?: unknown; 'fill-opacity'?: unknown } | undefined;
if (landPaint?.['fill-opacity'] !== scaleFillOpacity(0.85, 0.6) || landPaint?.['fill-color'] !== '#C65D00') {
  fail(`land opacity was not scaled: ${JSON.stringify(landPaint)}`);
}
if (depthPaint?.['fill-opacity'] !== 0.33) fail(`depth opacity was not scaled: ${JSON.stringify(depthPaint)}`);
if (coastPaint?.['line-color'] !== '#000000' || coastPaint?.['fill-opacity'] != null) fail('coast line was changed');
const landAlias = landPaint as { 'fill-antialias'?: unknown } | undefined;
const depthAlias = depthPaint as { 'fill-antialias'?: unknown } | undefined;
const coastAlias = coastPaint as { 'fill-antialias'?: unknown } | undefined;
if (landAlias?.['fill-antialias'] !== false || depthAlias?.['fill-antialias'] !== false) fail('cell fills stayed anti-aliased');
if (coastAlias?.['fill-antialias'] != null) fail('coast line gained fill-antialias');
const expr = scaleFillOpacity(['interpolate', ['linear'], ['get', 'depth'], 0, 1], 0.6);
if (!Array.isArray(expr) || expr[0] !== '*') fail('expression opacity');

const picked = pickSatelliteUnderlay(
  [
    { kind: 'satellite', bounds: [-180, -80, 180, 80] },
    { kind: 'satellite', bounds: [-64.7, 18.35, -64.52, 18.48] },
    { kind: 'nautical', bounds: [-64.7, 18.35, -64.52, 18.48] },
  ],
  -64.61,
  18.42,
);
if (!picked || picked.bounds?.[0] !== -64.7) fail('underlay should be the smaller satellite that contains the point');
if (pickSatelliteUnderlay([{ kind: 'satellite', bounds: [0, 0, 1, 1] }], -64.61, 18.42)) fail('far satellite was picked');

console.log('poseidonChart.check ok');
