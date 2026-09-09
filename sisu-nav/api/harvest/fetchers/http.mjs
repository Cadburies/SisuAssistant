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

/** JPEG / PNG / WEBP / GIF magic — HTTP 200 HTML/XML "error tiles" must not count as landed. */
export function isProbablyTile(buf) {
  if (!buf || buf.length < 32) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true; // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true; // GIF
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return true; // WEBP
  }
  return false;
}

/** Vector tiles: gzip-pbf or raw protobuf. Reject HTML/JSON error bodies. */
export function isProbablyPbf(buf) {
  if (!buf || buf.length < 20) return false;
  if (buf[0] === 0x1f && buf[1] === 0x8b) return true;
  if (buf[0] === 0x3c || buf[0] === 0x7b) return false;
  return true;
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
