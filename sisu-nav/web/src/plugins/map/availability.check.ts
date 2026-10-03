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
if (ranked.rows.filter((r) => r.source.id === 'esri').length !== 1) fail('Esri split into two rows');
const esri = ranked.rows.find((r) => r.source.id === 'esri');
if (!esri?.badge.includes('live fills gaps')) fail(`Esri badge: ${esri?.badge}`);
if (ids.includes('noaa-enc')) fail('NOAA is in the main list');
if (!ranked.getCharts.some((g) => g.source.id === 'noaa-enc')) fail('NOAA missing from Get charts');
if (ids.includes('bing-aerial') || sources.some((s) => s.id === 'bing-aerial')) fail('Bing is a live row');
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
