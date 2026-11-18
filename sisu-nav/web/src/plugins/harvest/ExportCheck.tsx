import { useEffect, useRef, useState } from 'react';

type Current = { chart: string; name: string; read: number; bytes: number };

type CheckBody = {
  running?: boolean;
  ok?: boolean | null;
  message?: string | null;
  current?: Current | null;
};

async function readCheck(): Promise<CheckBody> {
  const res = await fetch('/api/chartbundle/export-check', { cache: 'no-store' });
  return (await res.json()) as CheckBody;
}

/** Compare Poseidon chart files with the hash record written before each copy. */
export function ExportCheck() {
  const [body, setBody] = useState<CheckBody | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    let stop = false;
    readCheck()
      .then((next) => {
        if (stop) return;
        setBody(next);
        if (next.running) setBusy(true);
      })
      .catch((err) => {
        if (stop) return;
        setBody({ running: false, ok: false, message: err instanceof Error ? err.message : String(err), current: null });
      });
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    let stop = false;
    const tick = async () => {
      try {
        const next = await readCheck();
        if (stop) return;
        setBody(next);
        if (next.running === false) setBusy(false);
      } catch (err) {
        if (stop) return;
        setBusy(false);
        setBody({ running: false, ok: false, message: err instanceof Error ? err.message : String(err), current: null });
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [busy]);

  const start = async () => {
    if (lock.current || busy) return;
    lock.current = true;
    setBody({ running: true, ok: null, message: 'Checking export records', current: null });
    try {
      const res = await fetch('/api/chartbundle/export-check', { method: 'POST' });
      const next = (await res.json()) as CheckBody;
      if (res.status === 409) {
        setBody({ running: true, ok: null, message: 'Check already running', current: null });
        setBusy(true);
        return;
      }
      if (res.status !== 202) {
        setBody({ running: false, ok: false, message: next.message || `Check failed (${res.status})`, current: null });
        return;
      }
      setBody(next);
      setBusy(true);
    } catch (err) {
      setBody({ running: false, ok: false, message: err instanceof Error ? err.message : String(err), current: null });
    } finally {
      lock.current = false;
    }
  };

  const current = body?.current;
  const pct = current && current.bytes > 0 ? Math.min(100, Math.floor((current.read / current.bytes) * 100)) : 0;
  const line = body?.running && current
    ? `Checking ${current.chart} ${current.name} ${pct}%`
    : body?.message;

  return (
    <div>
      <div className="hv-row">
        <button type="button" className="ghost" onClick={() => void start()} disabled={busy || body?.running === true}>
          {busy || body?.running ? 'Checking…' : 'Check Poseidon export'}
        </button>
      </div>
      {line ? <p className={body?.ok === false && !body.running ? 'hv-bad' : 'hv-note'}>{line}</p> : null}
    </div>
  );
}
