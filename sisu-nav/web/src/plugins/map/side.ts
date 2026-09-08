/**
 * Right-hand bar stack: which panel plugins show, and in which order (#109).
 * Persist order/hidden; editing is session-only so +/handles do not stick at sea.
 */
import type { NavPlugin } from '../../app/plugin';

const KEY = 'sisu-nav.side';

export type SideState = {
  order: string[];
  hidden: string[];
};

type Listener = () => void;
const listeners = new Set<Listener>();

function load(): SideState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { order: [], hidden: [] };
    const parsed = JSON.parse(raw) as Partial<SideState>;
    return {
      order: Array.isArray(parsed.order) ? parsed.order.filter((id) => typeof id === 'string') : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    return { order: [], hidden: [] };
  }
}

let persisted = load();
let editing = false;
let snap: SideState & { editing: boolean } = { ...persisted, editing };

function emit(): void {
  snap = { ...persisted, editing };
  for (const fn of listeners) fn();
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(persisted));
  } catch {
    /* quota */
  }
}

export function subscribeSide(fn: Listener): () => void {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}

export function getSideSnapshot(): SideState & { editing: boolean } {
  return snap;
}

export function isSideEditing(): boolean {
  return editing;
}

export function setSideEditing(on: boolean): void {
  editing = on;
  emit();
}

export function toggleSideEditing(): void {
  setSideEditing(!editing);
}

function asidePlugins(all: NavPlugin[]): NavPlugin[] {
  return all.filter((p) => p.slot === 'panel' && p.aside !== false && p.Component);
}

/** Merge stored order with current glob plugins (new ids append). */
export function resolveSide(all: NavPlugin[]): {
  stack: NavPlugin[];
  visible: NavPlugin[];
  hidden: NavPlugin[];
  hiddenIds: Set<string>;
} {
  const available = asidePlugins(all);
  const byId = new Map(available.map((p) => [p.id, p]));
  const ids = available.map((p) => p.id);

  const order: string[] = [];
  for (const id of persisted.order.length ? persisted.order : ids) {
    if (byId.has(id) && !order.includes(id)) order.push(id);
  }
  for (const id of ids) {
    if (!order.includes(id)) order.push(id);
  }

  const hiddenSet = new Set(persisted.hidden.filter((id) => byId.has(id)));
  const next: SideState = { order, hidden: [...hiddenSet] };
  if (next.order.join(',') !== persisted.order.join(',') || next.hidden.join(',') !== persisted.hidden.join(',')) {
    persisted = next;
    persist();
  }

  const stack: NavPlugin[] = [];
  const visible: NavPlugin[] = [];
  const hidden: NavPlugin[] = [];
  for (const id of order) {
    const p = byId.get(id);
    if (!p) continue;
    stack.push(p);
    if (hiddenSet.has(id)) hidden.push(p);
    else visible.push(p);
  }
  return { stack, visible, hidden, hiddenIds: hiddenSet };
}

export function setPluginHidden(id: string, hide: boolean): void {
  const hidden = new Set(persisted.hidden);
  if (hide) hidden.add(id);
  else hidden.delete(id);
  persisted = { ...persisted, hidden: [...hidden] };
  persist();
  emit();
}

export function movePlugin(id: string, dir: -1 | 1): void {
  const order = [...persisted.order];
  const i = order.indexOf(id);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= order.length) return;
  const tmp = order[i];
  order[i] = order[j];
  order[j] = tmp;
  persisted = { ...persisted, order };
  persist();
  emit();
}

export function movePluginTo(id: string, toIndex: number): void {
  const order = persisted.order.filter((x) => x !== id);
  const i = Math.max(0, Math.min(toIndex, order.length));
  order.splice(i, 0, id);
  persisted = { ...persisted, order };
  persist();
  emit();
}
