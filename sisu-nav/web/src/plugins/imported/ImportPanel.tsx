import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PluginProps } from '../../app/plugin';
import { fetchInbox, startImport, type InboxEntry } from './api';
import './imported.css';

/** Same product words as api/harvest/import.mjs inferKind. The name wins over the dropdown. */
function inferKind(name: string, fallback: 'nautical' | 'satellite' | 'bathymetry'): 'nautical' | 'satellite' | 'bathymetry' {
  const s = name.toLowerCase();
  if (/arcgis|bingsat|googlesat|\bsatellite\b|\besri\b|\bbing\b|\bgoogle\b/.test(s)) return 'satellite';
  if (/bathy|gebco|bluetopo|\bdepth\b/.test(s)) return 'bathymetry';
  if (/navionics|c-?map|cm93|garmin|\bnoaa\b|\benc\b/.test(s)) return 'nautical';
  return fallback;
}

function formatBytes(n: number): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

export function ImportPanel(_props: PluginProps) {
  const [dir, setDir] = useState('.');
  const [dirInput, setDirInput] = useState('.');
  const [listing, setListing] = useState<Awaited<ReturnType<typeof fetchInbox>> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<'nautical' | 'satellite' | 'bathymetry'>('nautical');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [pendingAll, setPendingAll] = useState(false);

  const reloadInbox = useCallback((d: string) => {
    fetchInbox(d)
      .then((l) => {
        setListing(l);
        setDir(l.dir);
        setDirInput(l.dir);
        setError(undefined);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    reloadInbox(dir);
  }, [dir, reloadInbox]);

  useEffect(() => {
    const t = window.setInterval(() => reloadInbox(dir), 8000);
    return () => window.clearInterval(t);
  }, [dir, reloadInbox]);

  const selectedBytes = useMemo(() => {
    if (!listing) return 0;
    return listing.entries.filter((e) => selected.has(e.relPath)).reduce((n, e) => n + e.bytes, 0);
  }, [listing, selected]);

  const toggleSel = (relPath: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  };

  const runImport = async (force: boolean, all: boolean) => {
    if (!listing) return;
    const items = all
      ? undefined
      : listing.entries.filter((e) => selected.has(e.relPath)).map((e) => {
          const slug = e.name
            .replace(/\.(mbtiles|pmtiles)$/i, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'chart';
          const label = e.peek?.name || e.name.replace(/\.(mbtiles|pmtiles)$/i, '');
          return {
            relPath: e.relPath,
            slug,
            kind: inferKind(`${slug} ${label} ${e.relPath}`, kind),
            label,
            type: e.type,
            bytes: e.bytes,
          };
        });
    if (!all && !items?.length) return;
    setPendingAll(all);
    setBusy(true);
    setError(undefined);
    try {
      await startImport({ dir: listing.dir, items, all, kind, force });
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const canImportAll = Boolean(
    listing && (listing.entries.length > 0 || listing.dirs.some((d) => !d.xyz)),
  );

  const parentDir = dir === '.' ? null : dir.split('/').slice(0, -1).join('/') || '.';

  return (
    <section className="imp">
      <div className="imp-head">
        <span>Imported charts</span>
      </div>
      <p className="imp-note">
        Folders already in <code>tiles/manual/</code> are on the chart. This drawer is only for an
        inbox drop. A zone folder named <code>place-product-date</code> keeps that name.
      </p>
      {listing ? (
        <p className="imp-muted mono">
          inbox {listing.inboxMounted ? listing.inboxPath : '(not mounted)'} · host {listing.host}
          {listing.warnLabel ? ` · warn above ${listing.warnLabel}` : ''}
        </p>
      ) : null}

      <label className="imp-field">
        <span>Folder inside inbox</span>
        <input
          value={dirInput}
          onChange={(e) => setDirInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setDir(dirInput || '.');
          }}
        />
      </label>
      <div className="imp-row">
        <button type="button" onClick={() => setDir(dirInput || '.')}>
          Open folder
        </button>
        <button type="button" className="ghost" onClick={() => reloadInbox(dir)}>
          Refresh
        </button>
        {parentDir != null ? (
          <button type="button" className="ghost" onClick={() => setDir(parentDir)}>
            Up
          </button>
        ) : null}
      </div>

      {listing?.dirs.filter((d) => !listing.entries.some((e) => e.relPath === d.relPath)).map((d) => (
        <button key={d.relPath} type="button" className="ghost" onClick={() => setDir(d.relPath)}>
          📁 {d.name}
        </button>
      ))}

      {listing?.entries.length ? (
        <>
          <div className="imp-row">
            <button
              type="button"
              className="ghost"
              onClick={() => setSelected(new Set(listing.entries.map((e) => e.relPath)))}
            >
              Select all
            </button>
            <button type="button" className="ghost" onClick={() => setSelected(new Set())}>
              None
            </button>
          </div>
          {listing.entries.map((e: InboxEntry) => (
            <label key={e.relPath} className="imp-entry">
              <input type="checkbox" checked={selected.has(e.relPath)} onChange={() => toggleSel(e.relPath)} />
              <span>
                {e.name}
                <br />
                <span className="imp-muted">
                  {e.type} · {e.kindGuess || inferKind(e.name, kind)} · {formatBytes(e.bytes)}
                  {e.peek?.minzoom != null ? ` · z${e.peek.minzoom}–${e.peek.maxzoom}` : ''}
                  {e.peek?.tileCount ? ` · ${e.peek.tileCount} tiles` : ''}
                </span>
              </span>
            </label>
          ))}
        </>
      ) : (
        <p className="imp-muted">No .mbtiles / .pmtiles / XYZ folders in this directory.</p>
      )}

      <label className="imp-field">
        <span>Kind when the name does not say</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="nautical">nautical (chart)</option>
          <option value="satellite">satellite</option>
          <option value="bathymetry">bathymetry</option>
        </select>
      </label>
      <p className="imp-muted">Selected {formatBytes(selectedBytes)}</p>
      {listing?.host === 'mac' && listing.warnLabel && selectedBytes > (listing.warnBytes || 0) && listing.warnBytes ? (
        <p className="imp-wait">
          That is a lot for this Mac — pick a smaller subset to test, or import the full dump on F8.
        </p>
      ) : null}
      <div className="imp-row">
        <button type="button" disabled={busy || !selected.size} onClick={() => void runImport(false, false)}>
          {busy ? 'Importing…' : 'Import selected'}
        </button>
        <button type="button" disabled={busy || !canImportAll} onClick={() => void runImport(false, true)}>
          Import all in this folder
        </button>
      </div>
      <p className="imp-muted">
        Import all copies archives here and one level of zone folders. bingsat, arcgis, googlesat,
        navionics, and sonar set the kind.
      </p>
      {error ? (
        <>
          <p className="imp-bad">{error}</p>
          {/heavy for this Mac/i.test(error) ? (
            <button type="button" className="ghost" onClick={() => void runImport(true, pendingAll)}>
              Import anyway
            </button>
          ) : null}
        </>
      ) : null}

      <p className="imp-muted">
        Nautical and satellite charts show up in the list when this view overlaps them. Bathymetry
        stays under Depth.
      </p>
    </section>
  );
}
