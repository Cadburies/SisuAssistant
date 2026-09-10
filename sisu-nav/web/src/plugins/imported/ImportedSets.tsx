import { useEffect, useState } from 'react';
import { getBasemap, setBasemapChoice, subscribeBasemap } from '../map/basemap';
import { fetchSets, type ImportSet } from './api';
import { listEnabledImports, setImportOn, subscribeImports } from './state';
import './imported.css';

export function ImportedSets({ kinds, empty }: { kinds?: string[]; empty?: string }) {
  const [sets, setSets] = useState<ImportSet[]>([]);
  const [on, setOn] = useState<Set<string>>(listEnabledImports);
  const [basemap, setBasemap] = useState(getBasemap);

  useEffect(() => subscribeImports(() => setOn(listEnabledImports())), []);
  useEffect(() => subscribeBasemap(() => setBasemap(getBasemap())), []);
  useEffect(() => {
    const load = () => {
      fetchSets()
        .then(setSets)
        .catch(() => {});
    };
    load();
    const t = window.setInterval(load, 8000);
    return () => window.clearInterval(t);
  }, []);

  const shown = kinds ? sets.filter((s) => kinds.includes(s.kind)) : sets;
  if (shown.length === 0) {
    return (
      <p className="imp-muted">
        {empty ?? 'Nothing imported yet. Use the Imported panel to pick a folder and which files.'}
      </p>
    );
  }
  return (
    <>
      {shown.map((s) => {
        const asBase = s.kind !== 'bathymetry';
        const checked = asBase
          ? basemap.kind === 'imported' && basemap.slug === s.slug
          : on.has(s.slug);
        return (
          <label key={s.slug} className="imp-set">
            <input
              type={asBase ? 'radio' : 'checkbox'}
              name={asBase ? 'sisu-imported-basemap' : undefined}
              checked={checked}
              onChange={(e) => {
                if (asBase) {
                  if (e.target.checked) setBasemapChoice({ kind: 'imported', slug: s.slug });
                } else {
                  setImportOn(s.slug, e.target.checked);
                }
              }}
            />
            <span>
              {s.label}{' '}
              <span className="imp-muted">({s.kind}{asBase ? ' · basemap' : ' · overlay'})</span>
            </span>
          </label>
        );
      })}
    </>
  );
}
