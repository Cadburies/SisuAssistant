/**
 * Run: node api/chartbundle/check.mjs
 * from sisu-nav.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundleFile, chartbundlePath } from './index.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chartbundle-'));
const dir = path.join(root, 'manual', 'nav-demo');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'nav-demo.mbtiles'), '');
fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ style: 'style.json', sprite: 'sprite' }));
fs.writeFileSync(path.join(dir, 'style.json'), '{"layers":[]}');
fs.writeFileSync(path.join(dir, 'sprite.json'), '{}');
fs.writeFileSync(path.join(dir, 'sprite.png'), 'png');
fs.writeFileSync(path.join(dir, 'coverage.geojson'), '{"type":"FeatureCollection","features":[]}');
fs.writeFileSync(path.join(dir, 'regions.geojson'), '{"type":"FeatureCollection","features":[]}');
const outside = path.join(root, 'secret.txt');
fs.writeFileSync(outside, 'no');
fs.symlinkSync(outside, path.join(dir, 'linked.txt'));

const id = 'manual_nav-demo_nav-demo';
const style = bundleFile(root, id, 'style');
const png = bundleFile(root, id, 'sprite.png');
if (!style || !style.endsWith(`${path.sep}style.json`)) {
  console.error('style not resolved', style);
  process.exit(1);
}
if (!png || !png.endsWith(`${path.sep}sprite.png`)) {
  console.error('sprite not resolved', png);
  process.exit(1);
}
if (bundleFile(root, id, 'sprite.json') == null) process.exit(1);
const coverage = bundleFile(root, id, 'coverage.geojson');
const regions = bundleFile(root, id, 'regions.geojson');
if (!coverage || !coverage.endsWith(`${path.sep}coverage.geojson`)) {
  console.error('coverage not resolved', coverage);
  process.exit(1);
}
if (!regions || !regions.endsWith(`${path.sep}regions.geojson`)) {
  console.error('regions not resolved', regions);
  process.exit(1);
}
if (bundleFile(root, '../secret', 'style') != null) {
  console.error('parent id was accepted');
  process.exit(1);
}
if (chartbundlePath('/api/chartbundle/%/style') != null) {
  console.error('broken encoding was accepted');
  process.exit(1);
}
const parsed = chartbundlePath(`/api/chartbundle/${id}/coverage.geojson`);
if (!parsed || parsed.id !== id || parsed.part !== 'coverage.geojson') {
  console.error('path was not parsed', parsed);
  process.exit(1);
}
if (bundleFile(root, id, '../secret.txt') != null) {
  console.error('parent part was accepted');
  process.exit(1);
}
fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ style: 'linked.txt', sprite: 'sprite' }));
if (bundleFile(root, id, 'style') != null) {
  console.error('symlink out of the archive directory was served');
  process.exit(1);
}
console.log('chartbundle.check ok');
