/**
 * Check a Poseidon export record. The exporter writes
 * export-hashes.json.incoming before it copies each file, then renames a
 * finished record to export-hashes.json. A crash leaves the incoming file.
 *
 * Record: { sisuExport: 1, chart, label, finished, files: [{ name, sha256, bytes }] }
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const RECORD = 'export-hashes.json';
export const INCOMING = 'export-hashes.json.incoming';

const NAME = /^[A-Za-z0-9._-]+$/;

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
}

export function readRecord(file) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { error: 'export record is unreadable' };
  }
  if (!raw || raw.sisuExport !== 1 || !Array.isArray(raw.files)) {
    return { error: 'export record is not version 1' };
  }
  const files = [];
  for (const row of raw.files) {
    if (!row || typeof row.name !== 'string' || typeof row.sha256 !== 'string' || !Number.isInteger(row.bytes) || row.bytes < 0) {
      return { error: 'export record is not version 1' };
    }
    files.push({ name: row.name, sha256: row.sha256, bytes: row.bytes });
  }
  return {
    chart: typeof raw.chart === 'string' ? raw.chart : '',
    label: typeof raw.label === 'string' ? raw.label : '',
    finished: raw.finished === true,
    files,
  };
}

function locate(dir, name) {
  if (!NAME.test(name) || name === RECORD || name.startsWith(`${RECORD}.`)) return { status: 'bad-name' };
  const full = path.join(dir, name);
  let st;
  try {
    st = fs.lstatSync(full);
  } catch {
    return { status: 'missing' };
  }
  if (!st.isFile() && !st.isSymbolicLink()) return { status: 'bad-name' };
  let root;
  let real;
  try {
    root = fs.realpathSync(dir);
    real = fs.realpathSync(full);
  } catch {
    return { status: 'bad-name' };
  }
  if (real !== root && !real.startsWith(root + path.sep)) return { status: 'bad-name' };
  let fileStat;
  try {
    fileStat = fs.statSync(real);
  } catch {
    return { status: 'missing' };
  }
  if (!fileStat.isFile()) return { status: 'bad-name' };
  return { status: 'file', path: real, bytes: fileStat.size };
}

export function hashFile(file, bytes, onRead) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(file);
    let read = 0;
    input.on('data', (chunk) => {
      hash.update(chunk);
      read += chunk.length;
      if (onRead && (read === bytes || read % (8 * 1024 * 1024) < chunk.length)) onRead(read, bytes);
    });
    input.on('error', reject);
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

function filePhrase(file) {
  if (file.status === 'missing') return `${file.name} is missing`;
  if (file.status === 'bad-name') return `${file.name} is not a file in this chart`;
  if (file.status === 'size') return `${file.name} is ${file.actualBytes} bytes, record expects ${file.expectedBytes}`;
  if (file.status === 'mismatch') return `${file.name} does not match the export record`;
  return `${file.name} matches`;
}

async function checkRecord(dir, kind, file, onFile) {
  const parsed = readRecord(file);
  const chart = parsed.chart || path.basename(dir);
  const label = parsed.label || chart;
  if (parsed.error) {
    return { chart, label, record: kind, finished: false, ok: false, detail: parsed.error, files: [] };
  }
  const files = [];
  for (const row of parsed.files) {
    const found = locate(dir, row.name);
    let status = found.status;
    const actualBytes = found.bytes ?? null;
    if (status === 'file') {
      if (found.bytes !== row.bytes) status = 'size';
      else {
        if (onFile) onFile({ chart: label, name: row.name, read: 0, bytes: row.bytes });
        const got = await hashFile(found.path, row.bytes, (read, total) => {
          if (onFile) onFile({ chart: label, name: row.name, read, bytes: total });
        });
        status = got === row.sha256 ? 'ok' : 'mismatch';
      }
    }
    files.push({ name: row.name, status, expectedBytes: row.bytes, actualBytes });
  }
  const bad = files.find((row) => row.status !== 'ok');
  const unfinished = kind === 'incoming' || parsed.finished !== true;
  const ok = !unfinished && files.length > 0 && !bad;
  let detail = 'matches';
  if (unfinished && bad) detail = `export did not finish. ${filePhrase(bad)}`;
  else if (unfinished) detail = `export did not finish. ${files.length} recorded files match.`;
  else if (bad) detail = filePhrase(bad);
  return { chart: parsed.chart || chart, label, record: kind, finished: parsed.finished, ok, detail, files };
}

export async function checkDir(dir, onFile) {
  const rows = [];
  const incoming = path.join(dir, INCOMING);
  const finalRecord = path.join(dir, RECORD);
  if (fs.existsSync(incoming)) rows.push(await checkRecord(dir, 'incoming', incoming, onFile));
  if (fs.existsSync(finalRecord)) rows.push(await checkRecord(dir, 'final', finalRecord, onFile));
  return rows;
}

export async function checkManual(tilesRoot, onFile) {
  const manual = path.join(tilesRoot, 'manual');
  let entries;
  try {
    entries = fs.readdirSync(manual, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    out.push(...(await checkDir(path.join(manual, ent.name), onFile)));
  }
  return out;
}

export function summary(rows) {
  if (!rows.length) return { ok: false, message: 'No Poseidon export record.' };
  const bad = rows.filter((row) => !row.ok);
  if (!bad.length) {
    const charts = new Set(rows.map((row) => row.chart));
    const n = charts.size;
    return { ok: true, message: `Poseidon export matches. ${n} ${n === 1 ? 'chart' : 'charts'}.` };
  }
  const bits = bad.slice(0, 4).map((row) => `${row.label}: ${row.detail}`);
  return { ok: false, message: `Poseidon export does not match. ${bits.join(' ')}` };
}

let job = null;

function view(current) {
  return {
    running: current.running,
    ok: current.ok,
    message: current.message,
    current: current.current,
    charts: current.charts,
  };
}

export function handle(req, res, tilesRoot) {
  if (req.method === 'GET') {
    send(res, 200, job ? view(job) : { running: false, ok: null, message: null, current: null, charts: [] });
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'method' });
    return;
  }
  if (job?.running) {
    send(res, 409, { error: 'check already running' });
    return;
  }
  const mine = {
    running: true,
    ok: null,
    message: 'Checking export records',
    current: null,
    charts: [],
  };
  job = mine;
  checkManual(tilesRoot, (current) => {
    mine.current = current;
  })
    .then((rows) => {
      const sum = summary(rows);
      mine.charts = rows;
      mine.ok = sum.ok;
      mine.message = sum.message;
      mine.current = null;
      mine.running = false;
    })
    .catch((err) => {
      mine.running = false;
      mine.ok = false;
      mine.current = null;
      mine.message = err instanceof Error ? err.message : String(err);
    });
  send(res, 202, view(mine));
}
