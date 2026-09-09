/**
 * Day/night theme (#122). Night is the default and always was the app's
 * only look before this; day is an explicit opt-in (not prefers-color-scheme
 * driven) — a boat cockpit shouldn't silently repaint itself based on the
 * OS setting, only when someone actually asks for high-contrast daylight
 * colors. Persisted per-browser, same shape as side.ts/layers.ts.
 */
export type Theme = 'dark' | 'light';

const KEY = 'sisu-nav.theme';

type Listener = () => void;
const listeners = new Set<Listener>();

function load(): Theme {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

let theme = load();

function apply(t: Theme): void {
  // Night is the bare :root — only stamp data-theme for day, so a future
  // agent grepping for the "default" palette still finds it on :root.
  if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
}

apply(theme);

function persist(): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore quota */
  }
}

function emit(): void {
  for (const fn of listeners) fn();
}

export function getTheme(): Theme {
  return theme;
}

export function setTheme(next: Theme): void {
  if (next === theme) return;
  theme = next;
  apply(theme);
  persist();
  emit();
}

export function toggleTheme(): void {
  setTheme(theme === 'dark' ? 'light' : 'dark');
}

export function subscribeTheme(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
