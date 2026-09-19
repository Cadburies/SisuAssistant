/**
 * Gitignored local key store for the Settings panel (#123).
 *
 * Precedence: keys.local.json (this file) then process.env (compose /
 * secrets.yaml). The API never writes secrets.yaml from this module —
 * that path stays #102 harvest SecretField. Local wins when both are set.
 *
 * Never log a stored or submitted value.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.join(HERE, '..', 'data', 'keys.local.json');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Catalog: real rows are writable; stubs are inventory-only. */
export const CATALOG = [
  {
    env: 'MAPTILER_API_KEY',
    label: 'MapTiler',
    kind: 'secret',
    help: 'https://cloud.maptiler.com/account/keys/',
    usedBy: 'Charts / Bathymetry harvest',
  },
  {
    env: 'MAXAR_API_KEY',
    label: 'Maxar',
    kind: 'secret',
    help: 'https://www.maxar.com/',
    usedBy: 'Charts harvest (official export)',
  },
  {
    env: 'PLANET_API_KEY',
    label: 'Planet',
    kind: 'secret',
    help: 'https://developers.planet.com/',
    usedBy: 'Charts harvest (official export)',
  },
  {
    env: 'MAPBOX_ACCESS_TOKEN',
    label: 'Mapbox',
    kind: 'secret',
    help: 'https://account.mapbox.com/access-tokens/',
    usedBy: 'Live Mapbox Satellite + harvest',
  },
  {
    env: 'GOOGLE_MAPS_API_KEY',
    label: 'Google Maps',
    kind: 'secret',
    help: 'https://console.cloud.google.com/google/maps-apis',
    usedBy: 'Live Google Satellite (Map Tiles API)',
  },
  {
    env: 'AZURE_MAPS_SUBSCRIPTION_KEY',
    label: 'Azure Maps',
    kind: 'secret',
    help: 'https://azure.microsoft.com/products/azure-maps/',
    usedBy: 'Live Azure Maps Imagery (replaces Bing)',
  },
  {
    env: 'AISSTREAM_API_KEY',
    label: 'AISStream',
    kind: 'secret',
    help: 'https://aisstream.io',
    usedBy: 'Global AIS overlay',
  },
  {
    env: 'INFLUXDB_URL',
    label: 'InfluxDB URL',
    kind: 'url',
    usedBy: 'Wind roses',
  },
  {
    env: 'INFLUXDB_ORG',
    label: 'InfluxDB org',
    kind: 'text',
    usedBy: 'Wind roses',
  },
  {
    env: 'INFLUXDB_TOKEN',
    label: 'InfluxDB token',
    kind: 'secret',
    usedBy: 'Wind roses',
  },
  {
    env: 'BING_MAPS_API_KEY',
    label: 'Bing Maps',
    kind: 'stub',
    issue: 117,
    stubMessage: 'Not implemented yet',
    usedBy: 'Bing Maps Basic retired 2026-06-30 — use Azure Maps. Harvest leftover is #117.',
  },
  {
    env: 'APPLE_MAPS_TOKEN',
    label: 'Apple Maps',
    kind: 'stub',
    issue: 117,
    stubMessage: 'Not implemented yet',
    usedBy: 'No harvestable tile API; live-display-only if #117 finds a path.',
  },
];

const BY_ENV = new Map(CATALOG.map((row) => [row.env, row]));

function keysFile() {
  return process.env.SISU_KEYS_FILE || DEFAULT_FILE;
}

function isSet(v) {
  return Boolean(v) && v !== 'CHANGE_ME';
}

function mask(value) {
  if (!isSet(value)) return null;
  const s = String(value);
  if (s.length <= 4) return '••••';
  return `••••${s.slice(-4)}`;
}

function readStore() {
  const file = keysFile();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch (err) {
    if (err && err.code === 'ENOENT') return {};
    throw httpError(500, 'local key store unreadable');
  }
}

function writeStore(store) {
  const file = keysFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* bind-mount chmod can no-op */
  }
}

/** Env as it was after compose + secrets.yaml, before local overlay. */
const bootEnv = {};
let snapped = false;

function snapBootEnv() {
  if (snapped) return;
  for (const row of CATALOG) {
    if (row.kind === 'stub') continue;
    bootEnv[row.env] = process.env[row.env] || '';
  }
  snapped = true;
}

/** Overlay local keys onto process.env so existing readers pick them up. */
export function applyLocalKeys() {
  snapBootEnv();
  const local = readStore();
  for (const row of CATALOG) {
    if (row.kind === 'stub') continue;
    if (isSet(local[row.env])) process.env[row.env] = local[row.env];
    else process.env[row.env] = bootEnv[row.env];
  }
}

export function listKeys() {
  const local = readStore();
  const keys = CATALOG.map((row) => {
    if (row.kind === 'stub') {
      return {
        env: row.env,
        label: row.label,
        kind: row.kind,
        usedBy: row.usedBy,
        stub: true,
        stubMessage: row.stubMessage,
        issue: row.issue,
        configured: false,
        preview: null,
        source: null,
      };
    }
    const localVal = local[row.env];
    const envVal = bootEnv[row.env] || process.env[row.env] || '';
    const source = isSet(localVal) ? 'local' : isSet(envVal) ? 'env' : null;
    const value = isSet(localVal) ? localVal : envVal;
    return {
      env: row.env,
      label: row.label,
      kind: row.kind,
      usedBy: row.usedBy,
      help: row.help || null,
      stub: false,
      configured: isSet(value),
      preview: mask(value),
      source,
    };
  });
  return {
    keys,
    precedence: 'local store, then process.env (secrets.yaml / compose)',
    store: keysFile(),
  };
}

/**
 * @param {Record<string, string>} updates env → value; empty / CHANGE_ME clears the local override
 */
export function saveKeys(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw httpError(400, 'expected { keys: { ENV: value, ... } }');
  }
  snapBootEnv();
  const store = readStore();
  const saved = [];
  for (const [env, raw] of Object.entries(updates)) {
    const row = BY_ENV.get(env);
    if (!row) throw httpError(400, `unknown key ${env}`);
    if (row.kind === 'stub') {
      throw httpError(400, `${env}: Not implemented yet (#${row.issue})`);
    }
    const value = String(raw ?? '').trim();
    if (!value || value === 'CHANGE_ME') {
      delete store[env];
      process.env[env] = bootEnv[env] || '';
      saved.push({ env, configured: isSet(process.env[env]), source: isSet(process.env[env]) ? 'env' : null });
      continue;
    }
    store[env] = value;
    process.env[env] = value;
    saved.push({ env, configured: true, source: 'local' });
  }
  writeStore(store);
  return { saved };
}
