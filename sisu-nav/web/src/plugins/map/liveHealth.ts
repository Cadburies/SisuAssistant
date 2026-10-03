import type { LiveBasemapId } from './basemap.ts';

const failing = new Set<LiveBasemapId>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function markLiveFailing(id: LiveBasemapId | null): void {
  if (!id || failing.has(id)) return;
  failing.add(id);
  emit();
}

export function clearLiveFailing(id: LiveBasemapId | null): void {
  if (!id || !failing.has(id)) return;
  failing.delete(id);
  emit();
}

export function liveFailing(): ReadonlySet<LiveBasemapId> {
  return failing;
}

export function subscribeLiveHealth(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
