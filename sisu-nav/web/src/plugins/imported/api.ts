export type InboxEntry = {
  name: string;
  relPath: string;
  type: string;
  bytes: number;
  kindGuess?: string;
  peek?: {
    name?: string | null;
    format?: string | null;
    minzoom?: number | null;
    maxzoom?: number | null;
    bounds?: number[] | null;
    tileCount?: number;
  } | null;
};

export type InboxListing = {
  host: string;
  inboxMounted: boolean;
  inboxPath: string;
  warnBytes: number | null;
  warnLabel: string | null;
  dir: string;
  entries: InboxEntry[];
  dirs: { name: string; relPath: string; xyz: boolean }[];
};

export type ImportSet = {
  slug: string;
  label: string;
  kind: string;
  attribution: string;
  notes: string;
  files: string[];
  imported: boolean;
};

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: (T & { error?: string }) | undefined;
  try {
    body = text ? (JSON.parse(text) as T & { error?: string }) : undefined;
  } catch {
    body = undefined;
  }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  if (body === undefined) throw new Error(`empty JSON (HTTP ${res.status})`);
  return body;
}

export async function fetchInbox(dir = '.'): Promise<InboxListing> {
  const res = await fetch(`/api/harvest/import/inbox?dir=${encodeURIComponent(dir)}`, { cache: 'no-store' });
  return asJson<InboxListing>(res);
}

export async function fetchSets(): Promise<ImportSet[]> {
  const res = await fetch('/api/harvest/import/sets', { cache: 'no-store' });
  const j = await asJson<{ sets: ImportSet[] }>(res);
  return j.sets ?? [];
}

export async function startImport(input: {
  dir: string;
  items?: Array<{
    relPath: string;
    slug?: string;
    kind?: string;
    label?: string;
    type?: string;
    bytes?: number;
  }>;
  all?: boolean;
  kind?: string;
  force?: boolean;
}): Promise<{ id: string; status: string; warn?: boolean; error?: string; bytes?: number; total?: number }> {
  const res = await fetch('/api/harvest/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`) as Error & { job?: unknown };
    err.job = body.job;
    throw err;
  }
  return body;
}

export async function fetchImportJobs(): Promise<Array<{ id: string; status: string; completed: number; total: number; error?: string | null }>> {
  const res = await fetch('/api/harvest/import/jobs', { cache: 'no-store' });
  const j = await asJson<{ jobs: Array<{ id: string; status: string; completed: number; total: number; error?: string | null }> }>(res);
  return j.jobs ?? [];
}
