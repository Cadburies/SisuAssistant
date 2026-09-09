import { useState } from 'react';
import { clearHarvestSecret, saveHarvestSecret } from './api';
import './harvest.css';

const HELP: Record<string, { label: string; href: string }> = {
  MAPTILER_API_KEY: { label: 'MapTiler Cloud', href: 'https://cloud.maptiler.com/account/keys/' },
  MAXAR_API_KEY: { label: 'Maxar', href: 'https://www.maxar.com/' },
  PLANET_API_KEY: { label: 'Planet', href: 'https://developers.planet.com/' },
};

export function SecretField({
  secretEnv,
  configured,
  onChange,
}: {
  secretEnv: string;
  configured: boolean;
  onChange: () => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const help = HELP[secretEnv];

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await saveHarvestSecret(secretEnv, value);
      setValue('');
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await clearHarvestSecret(secretEnv);
      setValue('');
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hv-secret">
      {configured ? (
        <p className="hv-muted">
          Server key for <code>{secretEnv}</code> is set (stored in boat secrets.yaml).
        </p>
      ) : (
        <p className="hv-wait">
          Paste a <code>{secretEnv}</code> to enable harvest. Saved on the boat, not in the browser.
        </p>
      )}
      {help ? (
        <p className="hv-muted">
          Get a key from{' '}
          <a href={help.href} target="_blank" rel="noreferrer">
            {help.label}
          </a>
          .
        </p>
      ) : null}
      <label className="hv-field">
        <span>{configured ? 'Replace key' : 'API key'}</span>
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={configured ? '••••' : ''}
        />
      </label>
      <div className="hv-row">
        <button type="button" disabled={busy || !value.trim()} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save on server'}
        </button>
        {configured ? (
          <button type="button" className="ghost" disabled={busy} onClick={() => void clear()}>
            Clear
          </button>
        ) : null}
      </div>
      {error ? <p className="hv-bad">{error}</p> : null}
    </div>
  );
}
