/** Instruments grid persist (#109). Cells are metric ids; '' is an empty picker slot. */

export type InstRow = { id: string; cells: string[] };

export type InstLayout = { rows: InstRow[] };

export const MAX_CELLS = 4;

const KEY = 'sisu-nav.instruments';

const DEFAULT: InstLayout = {
  rows: [
    { id: 'r1', cells: ['twd', 'tws'] },
    { id: 'r2', cells: ['awa', 'aws'] },
    { id: 'r3', cells: ['twa', 'hdg'] },
  ],
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const fn of listeners) fn();
}

function newId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function load(): InstLayout {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw) as Partial<InstLayout>;
    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) return structuredClone(DEFAULT);
    const rows: InstRow[] = [];
    for (const r of parsed.rows) {
      if (!r || typeof r !== 'object') continue;
      const cells = Array.isArray(r.cells)
        ? r.cells.filter((c) => typeof c === 'string').slice(0, MAX_CELLS)
        : [];
      if (!cells.length) continue;
      rows.push({ id: typeof r.id === 'string' && r.id ? r.id : newId(), cells });
    }
    return rows.length ? { rows } : structuredClone(DEFAULT);
  } catch {
    return structuredClone(DEFAULT);
  }
}

let layout = load();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    /* quota */
  }
  emit();
}

export function subscribeInstruments(fn: Listener): () => void {
  listeners.add(fn);
  fn();
  return () => listeners.delete(fn);
}

export function getInstruments(): InstLayout {
  return layout;
}

export function valueFontPx(n: number): number {
  if (n <= 1) return 32;
  if (n === 2) return 20;
  if (n === 3) return 16;
  return 13;
}

export function addRow(): void {
  layout = { rows: [...layout.rows, { id: newId(), cells: [''] }] };
  persist();
}

export function addCell(rowId: string): string | undefined {
  const rows = layout.rows.map((r) => ({ ...r, cells: [...r.cells] }));
  const row = rows.find((r) => r.id === rowId);
  if (!row) return 'row gone';
  if (row.cells.length >= MAX_CELLS) return `max ${MAX_CELLS} metrics in a row`;
  row.cells.push('');
  layout = { rows };
  persist();
  return undefined;
}

export function setCell(rowId: string, index: number, metricId: string): void {
  const rows = layout.rows.map((r) => ({ ...r, cells: [...r.cells] }));
  const row = rows.find((r) => r.id === rowId);
  if (!row || index < 0 || index >= row.cells.length) return;
  row.cells[index] = metricId;
  layout = { rows };
  persist();
}

export function removeCell(rowId: string, index: number): void {
  let rows = layout.rows.map((r) => ({ ...r, cells: [...r.cells] }));
  const row = rows.find((r) => r.id === rowId);
  if (!row || index < 0 || index >= row.cells.length) return;
  row.cells.splice(index, 1);
  rows = rows.filter((r) => r.cells.length > 0);
  layout = { rows };
  persist();
}

export function moveRow(rowId: string, dir: -1 | 1): void {
  const rows = [...layout.rows];
  const i = rows.findIndex((r) => r.id === rowId);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= rows.length) return;
  const tmp = rows[i];
  rows[i] = rows[j];
  rows[j] = tmp;
  layout = { rows };
  persist();
}

export function moveRowTo(rowId: string, toIndex: number): void {
  const rows = layout.rows.filter((r) => r.id !== rowId);
  const src = layout.rows.find((r) => r.id === rowId);
  if (!src) return;
  const i = Math.max(0, Math.min(toIndex, rows.length));
  rows.splice(i, 0, src);
  layout = { rows };
  persist();
}

export function moveCell(
  fromRow: string,
  fromIndex: number,
  toRow: string,
  toIndex: number,
): string | undefined {
  const rows = layout.rows.map((r) => ({ ...r, cells: [...r.cells] }));
  const src = rows.find((r) => r.id === fromRow);
  const dst = rows.find((r) => r.id === toRow);
  if (!src || !dst) return 'row gone';
  if (fromIndex < 0 || fromIndex >= src.cells.length) return 'cell gone';
  const [cell] = src.cells.splice(fromIndex, 1);
  if (fromRow === toRow && toIndex > fromIndex) toIndex -= 1;
  if (dst.cells.length >= MAX_CELLS) {
    src.cells.splice(fromIndex, 0, cell);
    return `max ${MAX_CELLS} metrics in a row`;
  }
  const i = Math.max(0, Math.min(toIndex, dst.cells.length));
  dst.cells.splice(i, 0, cell);
  layout = { rows: rows.filter((r) => r.cells.length > 0) };
  persist();
  return undefined;
}
