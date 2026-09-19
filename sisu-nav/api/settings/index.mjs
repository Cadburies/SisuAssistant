/** HTTP routes for the Settings key panel (#123). Mounted at /api/settings. */
import { applyLocalKeys, listKeys, saveKeys } from './keys.mjs';

applyLocalKeys();

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(data);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 64_000) {
        req.destroy();
        reject(Object.assign(new Error('request body too large'), { status: 413 }));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(Object.assign(new Error('invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

export async function handle(req, res, url) {
  try {
    if (req.method === 'GET' && url.pathname === '/api/settings/keys') {
      return json(res, 200, listKeys());
    }
    if (req.method === 'POST' && url.pathname === '/api/settings/keys') {
      const body = await readJsonBody(req);
      const updates = body.keys && typeof body.keys === 'object' ? body.keys : null;
      if (!updates) {
        const err = new Error('expected { keys: { ENV: value, ... } }');
        err.status = 400;
        throw err;
      }
      return json(res, 200, saveKeys(updates));
    }
    return json(res, 404, { error: 'not found' });
  } catch (err) {
    const status = err.status || 500;
    // Never echo submitted values — message is catalog/IO only.
    return json(res, status, { error: err.message || 'settings error' });
  }
}
