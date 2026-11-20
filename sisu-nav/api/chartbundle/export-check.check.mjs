/**
 * Run: node api/chartbundle/export-check.check.mjs
 * from sisu-nav.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkManual, hashFile, summary } from './export-check.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'export-check-'));
const manual = path.join(root, 'manual');
const good = path.join(manual, 'poseidon-nav');
const torn = path.join(manual, 'poseidon-sonar');
fs.mkdirSync(good, { recursive: true });
fs.mkdirSync(torn, { recursive: true });

const abc = Buffer.from('abc');
const abcHash = crypto.createHash('sha256').update(abc).digest('hex');
fs.writeFileSync(path.join(good, 'note.txt'), abc);
fs.writeFileSync(
  path.join(good, 'export-hashes.json'),
  JSON.stringify({
    sisuExport: 1,
    chart: 'poseidon-nav',
    label: 'Nautical Chart',
    finished: true,
    files: [{ name: 'note.txt', sha256: abcHash, bytes: 3 }],
  }),
);

fs.writeFileSync(path.join(torn, 'chart.mbtiles'), Buffer.from('partial'));
fs.writeFileSync(
  path.join(torn, 'export-hashes.json.incoming'),
  JSON.stringify({
    sisuExport: 1,
    chart: 'poseidon-sonar',
    label: 'SonarChart',
    finished: false,
    files: [{ name: 'chart.mbtiles', sha256: abcHash, bytes: 9 }],
  }),
);

const outside = path.join(root, 'secret.txt');
fs.writeFileSync(outside, 'no');
const escape = path.join(manual, 'poseidon-s57');
fs.mkdirSync(escape, { recursive: true });
fs.symlinkSync(outside, path.join(escape, 'linked.txt'));
fs.writeFileSync(
  path.join(escape, 'export-hashes.json'),
  JSON.stringify({
    sisuExport: 1,
    chart: 'poseidon-s57',
    label: 'S-57 ENC',
    finished: true,
    files: [{ name: '../secret.txt', sha256: abcHash, bytes: 2 }],
  }),
);

const absent = path.join(manual, 'poseidon-s57-detail');
fs.mkdirSync(absent, { recursive: true });
fs.writeFileSync(path.join(absent, 'style.json'), '{"layers":[]}');

const hashed = await hashFile(path.join(good, 'note.txt'), 3);
if (hashed !== 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad') {
  console.error('sha256 abc', hashed);
  process.exit(1);
}

const rows = await checkManual(root);
const goodRow = rows.find((row) => row.chart === 'poseidon-nav');
const tornRow = rows.find((row) => row.chart === 'poseidon-sonar');
const escapeRow = rows.find((row) => row.chart === 'poseidon-s57');
if (!goodRow?.ok || goodRow.detail !== 'matches') {
  console.error('good chart', goodRow);
  process.exit(1);
}
if (tornRow?.ok || !tornRow?.detail.includes('export did not finish') || !tornRow.detail.includes('is 7 bytes, record expects 9')) {
  console.error('torn chart', tornRow);
  process.exit(1);
}
if (escapeRow?.ok || escapeRow?.files?.[0]?.status !== 'bad-name') {
  console.error('escape', escapeRow);
  process.exit(1);
}
const absentRow = rows.find((row) => row.chart === 'poseidon-s57-detail');
if (absentRow?.ok || absentRow?.record !== 'missing' || !absentRow?.detail.startsWith('No export record')) {
  console.error('missing record', absentRow);
  process.exit(1);
}
const text = summary(rows);
if (
  text.ok ||
  !text.message.includes('SonarChart') ||
  !text.message.includes('S-57 ENC') ||
  !text.message.includes('poseidon-s57-detail')
) {
  console.error('summary', text);
  process.exit(1);
}
const none = summary([]);
if (none.ok || none.message !== 'No Poseidon export record.') {
  console.error('empty', none);
  process.exit(1);
}
console.log('export-check ok');
