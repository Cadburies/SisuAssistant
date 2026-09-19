import { useEffect, useState } from 'react';
import { fetchKeys, saveKeys } from './api';
import type { KeyRow } from './types';
import './settings.css';

export function SettingsPanel() {
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [precedence, setPrecedence] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [note, setNote] = useState<string | undefined>();

  async function refresh() {
    const cat = await fetchKeys();
    setRows(cat.keys);
    setPrecedence(cat.precedence);
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const save = async (env: string) => {
    const value = (drafts[env] || '').trim();
    if (!value) return;
    setBusy(env);
    setError(undefined);
    setNote(undefined);
    try {
      await saveKeys({ [env]: value });
      setDrafts((d) => ({ ...d, [env]: '' }));
      await refresh();
      setNote('Saved on the boat. Reload the page if a live basemap uses this key.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const clearLocal = async (env: string) => {
    setBusy(env);
    setError(undefined);
    setNote(undefined);
    try {
      await saveKeys({ [env]: '' });
      setDrafts((d) => ({ ...d, [env]: '' }));
      await refresh();
      setNote('Local override cleared. Compose / secrets.yaml value applies if set.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="st">
      <div className="st-head">API keys</div>
      <p className="st-muted">
        Stored on the boat in a gitignored local file, not in the browser. {precedence}. Charts
        harvest can still write <code>secrets.yaml</code> (#102); this panel wins when both are set.
      </p>
      {error ? <p className="st-err">{error}</p> : null}
      {note ? <p className="st-ok">{note}</p> : null}
      {rows.map((row) =>
        row.stub ? (
          <div key={row.env} className="st-card st-stub">
            <div className="st-card-head">
              <span>{row.label}</span>
              <code>{row.env}</code>
            </div>
            <p className="st-wait">
              {row.stubMessage} (#{row.issue}). {row.usedBy}
            </p>
            <input disabled placeholder="Not implemented yet" />
          </div>
        ) : (
          <div key={row.env} className="st-card">
            <div className="st-card-head">
              <span>{row.label}</span>
              <code>{row.env}</code>
            </div>
            <p className="st-muted">{row.usedBy}</p>
            <p className={row.configured ? 'st-ok' : 'st-wait'}>
              {row.configured
                ? `Configured ${row.preview || ''} (${row.source === 'local' ? 'Settings' : 'env / secrets.yaml'})`
                : 'Not configured'}
            </p>
            {row.help ? (
              <a className="st-link" href={row.help} target="_blank" rel="noreferrer">
                Get a key
              </a>
            ) : null}
            <label className="st-field">
              <span>{row.configured ? 'Replace' : 'Value'}</span>
              <input
                type={row.kind === 'secret' ? 'password' : 'text'}
                autoComplete="off"
                spellCheck={false}
                value={drafts[row.env] || ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [row.env]: e.target.value }))}
                placeholder={row.configured ? '••••' : ''}
              />
            </label>
            <div className="st-actions">
              <button
                type="button"
                className="primary"
                disabled={busy !== null || !(drafts[row.env] || '').trim()}
                onClick={() => void save(row.env)}
              >
                {busy === row.env ? 'Saving…' : 'Save'}
              </button>
              {row.source === 'local' ? (
                <button type="button" disabled={busy !== null} onClick={() => void clearLocal(row.env)}>
                  Clear local
                </button>
              ) : null}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
