/**
 * Which harvested depth provider feeds each overlay. One id per slot.
 * Legacy `sisu-nav.bathy-provider` migrates into the slot that provider paints.
 */
import { overlaySlot, type OverlaySlot } from '../map/sources.ts';

export type DepthPicks = Record<OverlaySlot, string | null>;

const KEY = 'sisu-nav.bathy-picks';
const LEGACY = 'sisu-nav.bathy-provider';
const PIN = 'sisu-nav.bathy-pinned';

type Listener = () => void;
const listeners = new Set<Listener>();

function empty(): DepthPicks {
  return { relief: null, hillshade: null, contours: null };
}

function load(): { picks: DepthPicks; pinned: boolean } {
  const picks = empty();
  let pinned = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DepthPicks>;
      picks.relief = parsed.relief ?? null;
      picks.hillshade = parsed.hillshade ?? null;
      picks.contours = parsed.contours ?? null;
    } else {
      const legacy = localStorage.getItem(LEGACY);
      if (legacy) {
        picks[overlaySlot(legacy)] = legacy;
        pinned = true;
      }
    }
    if (localStorage.getItem(PIN) === '1') pinned = true;
    if (localStorage.getItem(PIN) === '0') pinned = false;
  } catch {
    /* private mode */
  }
  return { picks, pinned };
}

let state = load();

function emit(): void {
  for (const fn of listeners) fn();
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.picks));
    localStorage.setItem(PIN, state.pinned ? '1' : '0');
  } catch {
    /* quota */
  }
}

export function getDepthPicks(): DepthPicks {
  return state.picks;
}

export function depthProviderIds(): string[] {
  return Object.values(state.picks).filter((id): id is string => Boolean(id));
}

export function isDepthPinned(): boolean {
  return state.pinned;
}

export function setDepthPick(slot: OverlaySlot, id: string | null): void {
  if (state.picks[slot] === id) return;
  state = { ...state, picks: { ...state.picks, [slot]: id } };
  persist();
  emit();
}

export function setDepthPinned(pinned: boolean): void {
  if (state.pinned === pinned) return;
  state = { ...state, pinned };
  persist();
  emit();
}

export function subscribeDepth(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
