/**
 * Zoom profile and detail-band model. Run:
 *   node --experimental-strip-types src/plugins/map/poseidonZoomProfile.check.ts
 * from sisu-nav/web. Not imported by the app.
 */
import {
  fallbackPoseidonProfile,
  loadPoseidonZoomProfile,
  minzoomCapForChart,
  normalizePoseidonZoomProfile,
  poseidonLadderAt,
  poseidonMinZoom,
  poseidonProfileEntryAt,
  profileDetailAt,
  profileUrl,
  setActivePoseidonProfile,
} from './poseidonZoomProfile.ts';

function fail(msg: string): never {
  throw new Error(msg);
}

const raw = {
  version: 1,
  chart: 'poseidon-nav',
  entries: [
    { minzoom: 12, maxzoom: 14, variant: 'poseidon-nav', detail: 'approach' },
    { minzoom: 10, maxzoom: 11, variant: 'poseidon-nav', detail: 'coastal' },
  ],
};
const profile = normalizePoseidonZoomProfile(raw, 'manual_poseidon-nav_poseidon-nav');
if (!profile) fail('valid profile rejected');
if (profile.entries[0].minzoom !== 10) fail('entries were not sorted');
if (poseidonProfileEntryAt(profile, 11)?.detail !== 'coastal') fail('coastal entry');
if (profileDetailAt(profile, 13) !== 'approach') fail('approach detail');
if (profileDetailAt(profile, 4) !== null) fail('no profile entry on overview');
if (poseidonMinZoom('poseidon-nav', profile) !== 10) fail('nav floor should be 10');
if (poseidonMinZoom('poseidon-s57', null) !== 7) fail('S-57 floor should be 7');
if (poseidonMinZoom('poseidon-s57-detail', profile) !== 10) fail('profile should raise S-57 detail floor');
if (minzoomCapForChart('manual_poseidon-sonar_poseidon-sonar') !== 10) fail('sonar cap');
if (minzoomCapForChart('other') !== 0) fail('unknown cap');
if (normalizePoseidonZoomProfile(raw, 'poseidon-sonar') !== null) fail('mismatched chart accepted');
if (normalizePoseidonZoomProfile({ version: 2, chart: 'poseidon-nav', entries: [] }, 'poseidon-nav') !== null) {
  fail('bad version accepted');
}
if (normalizePoseidonZoomProfile({ version: 1, chart: 'poseidon-nav', entries: [{ minzoom: 9, maxzoom: 3 }] }, 'poseidon-nav') !== null) {
  fail('reversed range accepted');
}
const fallback = fallbackPoseidonProfile('poseidon-nav');
if (fallback.entries.map((entry) => entry.minzoom).join(',') !== '7,9,10,11,12,13,14') fail('style fallback table');
if (poseidonLadderAt(profile, 13) !== null) fail('ladder must stay off until measured');
if (!profileUrl('poseidon-nav', '1:2').includes('zoom-profile.json?v=1%3A2')) fail('profile URL');
setActivePoseidonProfile('poseidon-nav', profile);

const fetched: string[] = [];
const loaded = await loadPoseidonZoomProfile('poseidon-nav', 'rev-1', (async (input: string) => {
  fetched.push(String(input));
  return new Response(JSON.stringify(raw), { status: 200 });
}) as typeof fetch);
if (!loaded || loaded.chart !== 'poseidon-nav') fail('loader did not return profile');
const again = await loadPoseidonZoomProfile('poseidon-nav', 'rev-1', (async () => {
  fail('valid profile fetched twice');
}) as typeof fetch);
if (!again) fail('cached profile lost');
const missing = await loadPoseidonZoomProfile('poseidon-sonar', 'rev-2', (async () => new Response('nope', { status: 404 })) as typeof fetch);
if (missing !== null) fail('404 profile should be null');
const invalid = await loadPoseidonZoomProfile('poseidon-s57', 'rev-3', (async () => new Response('{bad', { status: 200 })) as typeof fetch);
if (invalid !== null) fail('invalid profile should be null');
if (!fetched[0].includes('zoom-profile.json?v=rev-1')) fail(`profile URL ${fetched[0]}`);

console.log('poseidonZoomProfile.check ok');
