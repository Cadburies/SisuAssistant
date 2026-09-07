/** HTTP routes for the dated tile harvest (issue #80). Mounted at /api/harvest by ../server.mjs. */
import { listProvidersForUi } from './providers.mjs';
import { estimate, createJob, listJobs, getJob, resumeJob, scanResumable } from './jobs.mjs';

// Pick up any harvest left interrupted by a previous container run.
scanResumable();

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
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error('request body too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export async function handle(req, res, url) {
  try {
    if (req.method === 'GET' && url.pathname === '/api/harvest/providers') {
      return json(res, 200, { providers: listProvidersForUi() });
    }
    if (req.method === 'POST' && url.pathname === '/api/harvest/estimate') {
      const body = await readJsonBody(req);
      return json(res, 200, estimate(body));
    }
    if (req.method === 'POST' && url.pathname === '/api/harvest/jobs') {
      const body = await readJsonBody(req);
      return json(res, 201, await createJob(body));
    }
    if (req.method === 'GET' && url.pathname === '/api/harvest/jobs') {
      return json(res, 200, { jobs: listJobs() });
    }
    const resumeMatch = url.pathname.match(/^\/api\/harvest\/jobs\/([^/]+)\/resume$/);
    if (req.method === 'POST' && resumeMatch) {
      return json(res, 200, resumeJob(resumeMatch[1]));
    }
    const jobMatch = url.pathname.match(/^\/api\/harvest\/jobs\/([^/]+)$/);
    if (req.method === 'GET' && jobMatch) {
      const job = getJob(jobMatch[1]);
      if (!job) return json(res, 404, { error: 'not found' });
      return json(res, 200, job);
    }
    return json(res, 404, { error: 'not found' });
  } catch (err) {
    const status = (err && err.status) || 500;
    return json(res, status, { error: err instanceof Error ? err.message : String(err) });
  }
}
