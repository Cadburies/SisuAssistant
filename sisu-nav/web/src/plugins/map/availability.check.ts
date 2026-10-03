/**
 * BVI fixture for the chart list. Run:
 *   node --experimental-strip-types src/plugins/map/availability.check.ts
 * from sisu-nav/web. Not imported by the app.
 */
import type { Tileset } from '../../app/config.ts';
import type { Provider } from '../harvest/types.ts';
import { rankForView } from './availability.ts';
import { buildSources } from './sources.ts';

const bvi = [-64.9, 18.3, -64.3, 18.75] as [number, number, number, number];
const grenada = [-61.82, 12.0, -61.55, 12.25] as [number, number, number, number];

function provider(partial: Partial<Provider> & Pick<Provider, 'id' | 'label' | 'kind'>): Provider {
  return {
    access: 'free',
    harvestable: true,
    default: false,
    minZoom: 0,
    maxZoom: 18,
    attribution: '',
    notes: '',
    sourceUrl: '',
    exportLimitTiles: null,
    secretConfigured: true,
    autoHarvest: true,
    stub: false,
    ...partial,
  };
}

function tile(partial: Partial<Tileset> & Pick<Tileset, 'id' | 'file'>): Tileset {
  return {
    format: 'mbtiles',
    kind: 'nautical',
    ...partial,
  };
}

const providers = [
  provider({ id: 'esri-world-imagery', label: 'Esri World Imagery export', kind: 'satellite' }),
  provider({
    id: 'noaa-enc',
    label: 'NOAA Chart Display',
    kind: 'nautical',
    autoHarvest: false,
    coverageBbox: [-138, 17, -54, 59.6],
    outOfCoverageReason: 'NOAA Chart Display does not chart BVI / this view',
  }),
  provider({ id: 'eox-s2cloudless', label: 'EOX Sentinel-2 cloudless', kind: 'satellite', default: true }),
  provider({ id: 'google-satellite', label: 'Google Satellite', kind: 'satellite', access: 'secret', secretEnv: 'GOOGLE_MAPS_API_KEY', secretConfigured: true, autoHarvest: false }),
  provider({ id: 'azure-maps-imagery', label: 'Azure Maps Imagery', kind: 'satellite', access: 'secret', secretEnv: 'AZURE_MAPS_SUBSCRIPTION_KEY', secretConfigured: true, autoHarvest: false }),
  provider({ id: 'mapbox-satellite', label: 'Mapbox Satellite', kind: 'satellite', access: 'secret', secretEnv: 'MAPBOX_ACCESS_TOKEN', secretConfigured: false, autoHarvest: true }),
  provider({ id: 'bing-aerial', label: 'Bing Aerial (retired)', kind: 'satellite', harvestable: false }),
  provider({ id: 'openseamap', label: 'OpenSeaMap', kind: 'nautical', harvestable: false }),
  provider({ id: 'seascape-dem', label: 'Seascape DEM', kind: 'bathymetry', default: true }),
];

const tiles: Tileset[] = [];
for (let i = 1; i <= 6; i += 1) {
  tiles.push(
    tile({
      id: `nav-${i}`,
      file: `manual/navionics-bvi-${i}/chart.mbtiles`,
      label: `Navionics BVI ${i}`,
      providerLabel: `Navionics BVI ${i}`,
      imported: true,
      bounds: [-64.8, 18.35, -64.4, 18.7],
      minZoom: 8,
      maxZoom: 16,
      acquiredAt: `2026-05-0${i}`,
    }),
  );
}
tiles.push(
  tile({
    id: 'nav-gren',
    file: 'manual/navionics-grenada/chart.mbtiles',
    label: 'Navionics Grenada',
    providerLabel: 'Navionics Grenada',
    imported: true,
    bounds: grenada,
    minZoom: 8,
    maxZoom: 16,
  }),
);
tiles.push(
  tile({
    id: 'esri-bvi',
    file: 'satellite/esri-world-imagery/bvi/2026-05-01/esri-world-imagery.mbtiles',
    kind: 'satellite',
    provider: 'esri-world-imagery',
    label: 'Esri World Imagery export',
    bounds: [-64.85, 18.32, -64.35, 18.72],
    minZoom: 12,
    maxZoom: 18,
    sourceDate: '2026-05-01',
  }),
);
const zone = [-64.85, 18.32, -64.35, 18.72] as [number, number, number, number];
for (const [id, slug, label, kind] of [
  ['arc', 'virgin-islands-arcgis-2023-03', 'Virgin Islands · ArcGIS · 2023-03', 'satellite'],
  ['bing', 'virgin-islands-bingsat-2023-03', 'Virgin Islands · BingSat · 2023-03', 'satellite'],
  ['goog', 'virgin-islands-googlesat-2023-03', 'Virgin Islands · GoogleSat · 2023-03', 'satellite'],
  ['sonar', 'virgin-islands-navionics-2023-03-sonar', 'Virgin Islands · Navionics · sonar', 'nautical'],
  ['sat', 'bvi-satellite-dump', 'BVI satellite dump', 'satellite'],
] as const) {
  tiles.push(
    tile({
      id,
      file: `manual/${slug}/${slug}.mbtiles`,
      kind,
      label,
      providerLabel: label,
      provider: slug,
      imported: true,
      bounds: zone,
      minZoom: 12,
      maxZoom: 17,
      sourceDate: '2023-03-01',
    }),
  );
}

const sources = buildSources(providers, tiles);
const ranked = rankForView(sources, { bbox: bvi, zoom: 13 }, {
  keys: { mapbox: false, google: true, azure: true },
  liveFailing: new Set(),
  lastLiveId: null,
});

function fail(msg: string): never {
  throw new Error(msg);
}

const ids = ranked.rows.map((r) => r.source.id);
if (ids.filter((id) => id === 'navionics').length !== 1) fail(`expected one Navionics row, got ${ids.join(', ')}`);
const nav = ranked.rows.find((r) => r.source.id === 'navionics');
if (!nav || nav.atZoom.length !== 6) fail(`Navionics areas ${nav?.atZoom.length}`);
if (ids.includes('navionics-grenada') || sources.some((s) => s.files.some((f) => f.slug === 'navionics-grenada') && s.files.length === 1 && ids.includes(s.id))) {
  /* grenada shares the Navionics family; it must not be a row at this view */
}
const grenadaInView = ranked.rows.some((r) => r.overlap.some((f) => f.slug === 'navionics-grenada'));
if (grenadaInView) fail('Grenada file is in the BVI list');
if (!ids.includes('esri')) fail('missing Esri');
const esri = ranked.rows.find((r) => r.source.id === 'esri');
if (esri?.reason !== 'live' || esri.overlap.length) fail(`live Esri should be empty: ${esri?.badge} files=${esri?.overlap.length}`);
if (esri?.source.liveId == null) fail('live Esri lost its stream');
const esriSaved = ranked.rows.find((r) => r.source.id === 'esri-world-imagery');
if (!esriSaved?.overlap.some((f) => f.id === 'esri-bvi')) fail('harvested Esri missing');
if (esriSaved?.source.liveId) fail('harvested Esri still drives the live stream');
const azure = ranked.rows.find((r) => r.source.id === 'azure');
if (!azure || azure.overlap.length || azure.reason !== 'live') fail('Azure live row is not stream-only');
const bing = ranked.rows.find((r) => r.source.id === 'bing');
if (!bing?.overlap.some((f) => f.slug === 'virgin-islands-bingsat-2023-03')) fail('Bing is not its own downloaded row');
if (bing?.source.liveId) fail('Bing still turns on a live stream');
const google = ranked.rows.find((r) => r.source.id === 'google');
if (!google || google.overlap.length || google.reason !== 'live') fail('Google live row is not stream-only');
const googlesat = ranked.rows.find((r) => r.source.id === 'googlesat');
if (!googlesat?.overlap.some((f) => f.slug === 'virgin-islands-googlesat-2023-03')) fail('GoogleSat is not its own downloaded row');
const arc = ranked.rows.find((r) => r.source.id === 'arcgis');
if (!arc?.overlap.some((f) => f.slug === 'virgin-islands-arcgis-2023-03')) fail('ArcGIS is not its own downloaded row');
const sonar = ranked.rows.find((r) => r.source.id === 'navionics-sonar');
if (!sonar || sonar.atZoom.length !== 1) fail(`sonar row ${sonar?.atZoom.length}`);
if (!ranked.rows.some((r) => r.source.id === 'saved-satellite' && r.overlap.some((f) => f.slug === 'bvi-satellite-dump'))) {
  fail('unnamed satellite dump did not stay its own row');
}
if (ranked.rows.some((r) => /virgin-islands-|bvi-satellite-dump/.test(r.source.id))) fail(`zone became its own row: ${ids.join(', ')}`);
const bandOf = (id: string) => {
  const row = ranked.rows.find((r) => r.source.id === id);
  if (!row) return -1;
  if (row.source.liveId) return 0;
  return row.overlap.some((f) => f.imported) ? 2 : 1;
};
let prevBand = 0;
for (const id of ids) {
  const band = bandOf(id);
  if (band < prevBand) fail(`bands out of order: ${ids.join(', ')}`);
  prevBand = band;
}
if (ids.includes('noaa-enc')) fail('NOAA is in the main list');
if (!ranked.getCharts.some((g) => g.source.id === 'noaa-enc')) fail('NOAA missing from Get charts');
if (ids.includes('bing-aerial') || sources.some((s) => s.id === 'bing-aerial')) fail('retired Bing harvest is a row');
if (!ids.includes('azure')) fail('Azure missing');
if (!ids.includes('google')) fail('Google missing');
if (ranked.rows.find((r) => r.source.id === 'mapbox')?.reason !== 'needsKey') fail('Mapbox should need a key');
if (ranked.auto?.id !== 'navionics') fail(`auto picked ${ranked.auto?.id}`);
if (sources.some((s) => s.id === 'openseamap')) fail('OpenSeaMap is in the picker');

const wide = rankForView(sources, { bbox: [-62.2, 11.9, -61.4, 12.4], zoom: 10 }, {
  keys: { mapbox: false, google: true, azure: true },
  liveFailing: new Set(),
  lastLiveId: 'google',
});
if (!wide.rows.some((r) => r.overlap.some((f) => f.slug === 'navionics-grenada'))) fail('Grenada missing at Grenada');
if (wide.rows.some((r) => r.overlap.some((f) => f.slug?.startsWith('navionics-bvi')))) fail('BVI files shown at Grenada');

console.log('availability.check ok');
console.log(ranked.rows.map((r) => `${r.source.label} — ${r.badge}`).join('\n'));
