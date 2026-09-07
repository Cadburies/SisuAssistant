/** Shared tile-download helper — timeout + a couple of retries, nothing fancier. */

const UA = 'sisu-nav-harvest/1.0 (+https://github.com/Cadburies/SisuAssistant, issue #80)';

export async function fetchHead(url, { timeoutMs = 10000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, headers: { 'user-agent': UA } });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal,
        headers: { 'user-agent': UA, range: 'bytes=0-0' },
      });
    }
    return {
      ok: res.ok,
      lastModified: res.headers.get('last-modified'),
      etag: res.headers.get('etag'),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBuffer(url, { timeoutMs = 15000, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'user-agent': UA },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(300 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
