/** HTTP routes for the dated tile harvest (issue #80). Mounted at /api/harvest by ../server.mjs. */
import { listProvidersForUi } from './providers.mjs';
import { estimate, createJob, listJobs, getJob, resumeJob, scanResumable } from './jobs.mjs';
import { applyBoatSecrets, clearHarvestSecret, saveHarvestSecret, secretsMounted } from './secrets.mjs';
import {
  getImportJob,
  importStatus,
  listImportJobs,
  listInbox,
  listSets,
  startImport,
} from './import.mjs';

applyBoatSecrets();
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
      return json(res, 200, { providers: listProvidersForUi(), secretsMounted: secretsMounted() });
    }
    if (req.method === 'POST' && url.pathname === '/api/harvest/secrets') {
      const body = await readJsonBody(req);
      return json(res, 200, saveHarvestSecret(body.secretEnv, body.value));
    }
    const clearMatch = url.pathname.match(/^\/api\/harvest\/secrets\/([^/]+)$/);
    if (req.method === 'DELETE' && clearMatch) {
      return json(res, 200, clearHarvestSecret(decodeURIComponent(clearMatch[1])));
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
    if (req.method === 'GET' && url.pathname === '/api/harvest/import/status') {
      return json(res, 200, importStatus());
    }
    if (req.method === 'GET' && url.pathname === '/api/harvest/import/inbox') {
      return json(res, 200, listInbox(url.searchParams.get('dir') || '.'));
    }
    if (req.method === 'GET' && url.pathname === '/api/harvest/import/sets') {
      return json(res, 200, { sets: listSets() });
    }
    if (req.method === 'POST' && url.pathname === '/api/harvest/import') {
      const body = await readJsonBody(req);
      return json(res, 202, startImport(body));
    }
    if (req.method === 'GET' && url.pathname === '/api/harvest/import/jobs') {
      return json(res, 200, { jobs: listImportJobs() });
    }
    const impJob = url.pathname.match(/^\/api\/harvest\/import\/jobs\/([^/]+)$/);
    if (req.method === 'GET' && impJob) {
      const job = getImportJob(impJob[1]);
      if (!job) return json(res, 404, { error: 'not found' });
      return json(res, 200, job);
    }
    return json(res, 404, { error: 'not found' });
  } catch (err) {
    const status = (err && err.status) || 500;
    const body = { error: err instanceof Error ? err.message : String(err) };
    if (err && err.job) body.job = err.job;
    return json(res, status, body);
  }
}
