import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { loadConfig, type RuntimeConfig } from './config';
import { loadPlugins } from './loadPlugins';
import { LayoutGear } from '../plugins/layout/LayoutGear';
import { getSideSnapshot, resolveSide, subscribeSide } from '../plugins/map/side';
import { sk } from './sk';
import { fmt, fmtLat, fmtLon, skSpeedKn } from './units';

const plugins = loadPlugins();

export function App() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const snapshot = useSyncExternalStore(sk.subscribe, sk.getSnapshot, sk.getSnapshot);
  useSyncExternalStore(subscribeSide, getSideSnapshot, getSideSnapshot);

  useEffect(() => {
    let cancelled = false;
    loadConfig().then((cfg) => {
      if (cancelled) return;
      setConfig(cfg);
      sk.connect(cfg.signalkHttp);
    });
    return () => {
      cancelled = true;
      sk.disconnect();
    };
  }, []);

  const mapPlugin = plugins.find((p) => p.slot === 'map');
  const panels = plugins.filter((p) => p.slot === 'panel');
  const mapChrome = panels.filter((p) => p.aside === false);
  const { stack, visible, hidden, hiddenIds } = resolveSide(plugins);
  const pluginIds = useMemo(() => plugins.map((p) => p.id).join(', '), []);

  if (!config) {
    return (
      <div className="shell">
        <div className="boot">Sisu Nav…</div>
      </div>
    );
  }

  const Map = mapPlugin?.Component;
  const self = snapshot.self;
  const sog = skSpeedKn(self.sog);

  return (
    <div className="shell">
      <main className="map-slot">
        {Map ? <Map sk={snapshot} config={config} /> : <div className="boot">No map plugin</div>}
        {mapChrome.map((p) => {
          const C = p.Component;
          return C ? <C key={p.id} sk={snapshot} config={config} /> : null;
        })}
      </main>
      <aside className="side">
        <header className="sisu-side-head">
          <span>Sisu</span>
          <LayoutGear plugins={stack} hiddenIds={hiddenIds} />
        </header>
        {visible.map((p) => {
          const C = p.Component;
          return C ? <C key={p.id} sk={snapshot} config={config} /> : null;
        })}
      </aside>
      <div className="side-keep" hidden>
        {hidden.map((p) => {
          const C = p.Component;
          return C ? <C key={p.id} sk={snapshot} config={config} /> : null;
        })}
      </div>
      <footer className="bar">
        <StatusDot status={snapshot.status} />
        <span className="bar-label">{statusLabel(snapshot.status)}</span>
        <span className="mono">
          {fmtLat(self.lat)} {fmtLon(self.lon)}
        </span>
        <span className="mono">SOG {fmt(sog, 1)} kn</span>
        <span className="muted">plugins {pluginIds}</span>
        <span className="spacer" />
        {snapshot.status === 'auth' || snapshot.status === 'error' ? (
          <LoginForm defaultUser={snapshot.username} error={snapshot.error} />
        ) : (
          <button type="button" className="ghost" onClick={() => sk.logout()}>
            SK sign out
          </button>
        )}
      </footer>
    </div>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case 'live':
      return 'Signal K live';
    case 'connecting':
      return 'Signal K connecting';
    case 'auth':
      return 'Signal K login';
    case 'error':
      return 'Signal K error';
    default:
      return 'Signal K';
  }
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === 'live' ? 'ok' : status === 'auth' || status === 'error' ? 'bad' : 'wait';
  return <span className={`dot ${cls}`} />;
}

function LoginForm({ defaultUser, error }: { defaultUser: string; error?: string }) {
  const [user, setUser] = useState(defaultUser);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(error);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLocalError(undefined);
    try {
      await sk.login(user, password);
      setPassword('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login" onSubmit={onSubmit}>
      {localError ? <span className="err">{localError}</span> : null}
      <input
        value={user}
        onChange={(e) => setUser(e.target.value)}
        placeholder="SK user"
        autoComplete="username"
        aria-label="Signal K user"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        autoComplete="current-password"
        aria-label="Signal K password"
      />
      <button type="submit" disabled={busy || !user || !password}>
        {busy ? '…' : 'Connect'}
      </button>
    </form>
  );
}
