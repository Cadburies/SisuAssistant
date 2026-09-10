import { setLayerOn } from '../map/layers';

const KEY = 'sisu-nav.imports.on';
type Listener = () => void;
const listeners = new Set<Listener>();

function load(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter((s) => typeof s === 'string') : []);
  } catch {
    return new Set();
  }
}

let enabled = load();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...enabled]));
  } catch {
    /* quota */
  }
}

function emit(): void {
  for (const fn of listeners) fn();
}

export function listEnabledImports(): Set<string> {
  return new Set(enabled);
}

export function setImportOn(slug: string, on: boolean): void {
  if (on) enabled.add(slug);
  else enabled.delete(slug);
  persist();
  if (on) setLayerOn('imported-charts', true);
  emit();
}

export function subscribeImports(fn: Listener): () => void {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}
