const KEY = 'sisu-nav.imports.on';
const OPACITY = 'sisu-nav.imports.opacity';
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

function loadOpacity(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(OPACITY) || '{}') as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [slug, value] of Object.entries(raw)) {
      const n = Number(value);
      if (Number.isFinite(n)) out[slug] = Math.min(1, Math.max(0, n));
    }
    return out;
  } catch {
    return {};
  }
}

let enabled = load();
let opacities = loadOpacity();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...enabled]));
  } catch {
    /* quota */
  }
}

function persistOpacity(): void {
  try {
    localStorage.setItem(OPACITY, JSON.stringify(opacities));
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
  emit();
}

export function getImportOpacity(slug: string, fallback = 0.85): number {
  return opacities[slug] ?? fallback;
}

export function listImportOpacities(): Record<string, number> {
  return { ...opacities };
}

export function setImportOpacity(slug: string, opacity: number): void {
  const next = Math.min(1, Math.max(0, opacity));
  if (opacities[slug] === next) return;
  opacities = { ...opacities, [slug]: next };
  persistOpacity();
  emit();
}

export function subscribeImports(fn: Listener): () => void {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}
