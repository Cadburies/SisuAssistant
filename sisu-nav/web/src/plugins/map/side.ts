/**
 * Right-hand bar stack: which panel plugins show, and in which order (#109).
 * Persist order/hidden; editing is session-only so +/handles do not stick at sea.
 */
import { GROUP_ORDER, type NavPlugin, type PluginGroup } from '../../app/plugin';

const KEY = 'sisu-nav.side';

export type SideState = {
  order: string[];
  hidden: string[];
  /** Open domain. `null` = only the pinned NOW group is open. */
  openGroup: PluginGroup | null;
  /** Expanded panel per domain. Missing = the group opens its first panel. */
  openPanel: Partial<Record<PluginGroup, string | null>>;
};

type Listener = () => void;
const listeners = new Set<Listener>();

function empty(): SideState {
  return { order: [], hidden: [], openGroup: null, openPanel: {} };
}

function load(): SideState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<SideState>;
    const openGroup = GROUP_ORDER.includes(parsed.openGroup as PluginGroup)
      ? (parsed.openGroup as PluginGroup)
      : null;
    const openPanel: Partial<Record<PluginGroup, string | null>> = {};
    if (parsed.openPanel && typeof parsed.openPanel === 'object') {
      for (const group of GROUP_ORDER) {
        const value = parsed.openPanel[group];
        if (value === null || typeof value === 'string') openPanel[group] = value;
      }
    }
    return {
      order: Array.isArray(parsed.order) ? parsed.order.filter((id) => typeof id === 'string') : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((id) => typeof id === 'string') : [],
      openGroup,
      openPanel,
    };
  } catch {
    return empty();
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

/** Open one domain (or none). The pinned NOW group is rendered separately. */
export function setOpenGroup(group: PluginGroup | null): void {
  if (persisted.openGroup === group) return;
  persisted = { ...persisted, openGroup: group };
  persist();
  emit();
}

/** Expand one panel in a domain; clicking the open panel collapses it. */
export function setOpenPanel(group: PluginGroup, id: string): void {
  const open = persisted.openPanel[group] === id ? null : id;
  persisted = { ...persisted, openPanel: { ...persisted.openPanel, [group]: open } };
  persist();
  emit();
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
  const next: SideState = { ...persisted, order, hidden: [...hiddenSet] };
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

/** Swap two panels in place. Used by the grouped editor to stay inside a domain. */
export function swapPlugins(a: string, b: string): void {
  const order = [...persisted.order];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia < 0 || ib < 0 || ia === ib) return;
  [order[ia], order[ib]] = [order[ib], order[ia]];
  persisted = { ...persisted, order };
  persist();
  emit();
}
