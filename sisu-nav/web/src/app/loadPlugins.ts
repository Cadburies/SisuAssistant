import type { NavPlugin } from './plugin';

/**
 * Parallel-safety contract: later issues add `web/src/plugins/<id>/index.ts`
 * and never edit App.tsx. Vite globs this at build time.
 */
const modules = import.meta.glob('../plugins/*/index.ts', {
  eager: true,
}) as Record<string, { plugin?: NavPlugin; default?: NavPlugin }>;

export function loadPlugins(): NavPlugin[] {
  return Object.values(modules)
    .map((m) => m.plugin ?? m.default)
    .filter((p): p is NavPlugin => !!p && typeof p.id === 'string')
    .sort((a, b) => a.id.localeCompare(b.id));
}
