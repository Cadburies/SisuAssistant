/** Loads + exposes the provider registry (../providers.yaml, issue #80). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROVIDERS_PATH = path.join(HERE, '..', 'providers.yaml');

let cache = null;

/** Raw registry, keyed by provider id. Cached for the process lifetime — same
 * "no operator config, restart to pick up changes" spirit as tileserver-gl's
 * directory mode. */
export function loadProviders() {
  if (!cache) {
    const raw = fs.readFileSync(PROVIDERS_PATH, 'utf8');
    cache = parse(raw)?.providers || {};
  }
  return cache;
}

export function getProvider(id) {
  return loadProviders()[id];
}

/** A `secret`-access provider only runs once its named env var is actually set. */
export function isSecretConfigured(provider) {
  if (provider.access !== 'secret') return true;
  const val = provider.secretEnv ? process.env[provider.secretEnv] : undefined;
  return Boolean(val) && val !== 'CHANGE_ME';
}

/** UI-safe listing — never leaks a secret value, only whether one is set. */
export function listProvidersForUi() {
  return Object.entries(loadProviders()).map(([id, p]) => ({
    id,
    label: p.label,
    kind: p.kind,
    access: p.access,
    harvestable: p.harvestable !== false,
    default: Boolean(p.default),
    minZoom: p.minZoom ?? 0,
    maxZoom: p.maxZoom ?? 18,
    attribution: p.attribution || '',
    notes: p.notes || '',
    sourceUrl: p.sourceUrl || '',
    exportLimitTiles: p.exportLimitTiles ?? null,
    secretConfigured: isSecretConfigured(p),
    secretEnv: p.access === 'secret' ? p.secretEnv : undefined,
  }));
}
