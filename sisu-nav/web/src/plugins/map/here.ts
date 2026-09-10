/**
 * Browser geolocation for Follow me (#131). Not Signal K / AIS Sisu.
 * Requires a secure context (HTTPS or localhost).
 */

export type HereFix =
  | { ok: true; lat: number; lon: number; accuracyM?: number }
  | { ok: false; error: string };

type Listener = () => void;
const listeners = new Set<Listener>();
let current: HereFix | null = null;
let watchId: number | null = null;

function emit(): void {
  for (const fn of listeners) fn();
}

function setFix(next: HereFix): void {
  current = next;
  emit();
}

function startWatch(): void {
  if (watchId != null) return;
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    setFix({ ok: false, error: 'This browser has no geolocation.' });
    return;
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    setFix({
      ok: false,
      error: 'Location needs HTTPS or localhost (this page is plain HTTP).',
    });
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      setFix({
        ok: true,
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        accuracyM: p.coords.accuracy,
      });
    },
    (err) => {
      setFix({ ok: false, error: err.message || 'Location denied' });
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
}

function stopWatch(): void {
  if (watchId == null || typeof navigator === 'undefined') return;
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export function getHere(): HereFix | null {
  return current;
}

export function subscribeHere(fn: Listener): () => void {
  listeners.add(fn);
  fn();
  startWatch();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) stopWatch();
  };
}
