import { useEffect, useState } from 'react';
import { fetchSets, type ImportSet } from './api';
import { listEnabledImports, setImportOn, subscribeImports } from './state';
import './imported.css';

export function ImportedSets({ kinds, empty }: { kinds?: string[]; empty?: string }) {
  const [sets, setSets] = useState<ImportSet[]>([]);
  const [on, setOn] = useState<Set<string>>(listEnabledImports);

  useEffect(() => subscribeImports(() => setOn(listEnabledImports())), []);
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
      {shown.map((s) => (
        <label key={s.slug} className="imp-set">
          <input
            type="checkbox"
            checked={on.has(s.slug)}
            onChange={(e) => setImportOn(s.slug, e.target.checked)}
          />
          <span>
            {s.label} <span className="imp-muted">({s.kind})</span>
          </span>
        </label>
      ))}
    </>
  );
}
