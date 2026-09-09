/**
 * Global AIS overlay (issue #115) — AISStream.io, a Tier-4 internet-sourced
 * AIS feed. Complementary to, and never merged with, the browser's own
 * local `ais` layer (Signal K's `navigation.vessels`, i.e. this boat's own
 * receiver, VHF range only, see CLAUDE.md rule 11). This is internet data:
 * longer range, useful for passage planning, not to be trusted for local
 * collision avoidance.
 *
 * Maintains one persistent WebSocket to AISStream (Node 22's native,
 * unflagged `WebSocket` global — no `ws` dependency needed) and serves a
 * polled REST snapshot at GET /api/ais-global/vessels, mirroring the
 * "server holds the live connection, browser polls" shape already used for
 * roses (Influx) and harvest (job state).
 */
const WS_URL = 'wss://stream.aisstream.io/v0/stream';
const STALE_MS = 20 * 60 * 1000; // prune vessels not heard from in 20 min
const RECONNECT_MIN_MS = 2000;
const RECONNECT_MAX_MS = 60000;

// Wide Western Atlantic / Caribbean box — where Sisu actually cruises, not
// the whole world. AIS is a very high-volume global feed; a single personal
// receiver-equivalent has no business subscribing globally. Override with
// AISSTREAM_BOUNDING_BOXES (JSON, same [[[lat,lon],[lat,lon]], ...] shape
// AISStream itself expects) if the vessel operates somewhere else.
const DEFAULT_BOUNDING_BOXES = [
  [
    [5, -85],
    [45, -50],
  ],
];

function apiKey() {
  const k = process.env.AISSTREAM_API_KEY;
  return k && k !== 'CHANGE_ME' ? k : null;
}

function boundingBoxes() {
  const raw = process.env.AISSTREAM_BOUNDING_BOXES;
  if (!raw) return DEFAULT_BOUNDING_BOXES;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_BOUNDING_BOXES;
  } catch {
    return DEFAULT_BOUNDING_BOXES;
  }
}

const vessels = new Map(); // mmsi -> { mmsi, name, lat, lon, sog, cog, heading, updatedAt }
let ws = null;
let reconnectDelay = RECONNECT_MIN_MS;
let reconnectTimer = null;
let lastError = null;

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
}

async function messageText(raw) {
  // Node's native WebSocket (undici) delivers MessageEvent.data as a Blob
  // for text frames, not a string or Buffer like the `ws` npm package would
  // — .toString() on a Blob gives the literal string "[object Blob]", which
  // silently fails JSON.parse for every single message. Must read it async.
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw.text === 'function') return raw.text();
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString('utf8');
  return String(raw);
}

async function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(await messageText(raw));
  } catch {
    return;
  }
  if (msg.MessageType !== 'PositionReport') return;
  const meta = msg.MetaData || {};
  const pos = msg.Message?.PositionReport || {};
  const mmsi = meta.MMSI ?? pos.UserID;
  const lat = meta.Latitude ?? pos.Latitude;
  const lon = meta.Longitude ?? pos.Longitude;
  if (mmsi == null || typeof lat !== 'number' || typeof lon !== 'number') return;
  vessels.set(String(mmsi), {
    mmsi: String(mmsi),
    name: typeof meta.ShipName === 'string' ? meta.ShipName.trim() || null : null,
    lat,
    lon,
    sog: typeof pos.Sog === 'number' ? pos.Sog : null,
    cog: typeof pos.Cog === 'number' ? pos.Cog : null,
    // 511 is AIS's own "not available" sentinel for true heading.
    heading: typeof pos.TrueHeading === 'number' && pos.TrueHeading <= 360 ? pos.TrueHeading : null,
    updatedAt: Date.now(),
  });
}

function connect() {
  clearTimeout(reconnectTimer);
  const key = apiKey();
  if (!key) return; // nothing configured — the endpoint reports this, no point connecting
  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    scheduleReconnect();
    return;
  }
  ws.addEventListener('open', () => {
    reconnectDelay = RECONNECT_MIN_MS;
    lastError = null;
    ws.send(
      JSON.stringify({
        APIKey: key,
        BoundingBoxes: boundingBoxes(),
        FilterMessageTypes: ['PositionReport'],
      }),
    );
  });
  ws.addEventListener('message', (ev) => {
    void handleMessage(ev.data);
  });
  ws.addEventListener('error', (ev) => {
    lastError = ev && 'message' in ev ? String(ev.message) : 'ais-global websocket error';
  });
  ws.addEventListener('close', (ev) => {
    // A close with no prior 'error' event (e.g. AISStream rejecting a bad
    // key) would otherwise leave lastError as a stale null — surface
    // whatever reason came with the close frame instead.
    if (!lastError) lastError = ev && ev.reason ? String(ev.reason) : `connection closed (code ${ev?.code ?? '?'})`;
    ws = null;
    scheduleReconnect();
  });
}

// Connects immediately if a key is already present at process start. A key
// added later (settings screen — #123 — or a fresh container after editing
// secrets) takes effect on the next container restart; this module doesn't
// hot-poll the environment.
connect();

function prune() {
  const cutoff = Date.now() - STALE_MS;
  for (const [id, v] of vessels) {
    if (v.updatedAt < cutoff) vessels.delete(id);
  }
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(data);
}

export async function handle(req, res, url) {
  if (url.pathname !== '/api/ais-global/vessels') {
    return send(res, 404, { error: 'unknown ais-global route' });
  }
  if (!apiKey()) {
    return send(res, 412, {
      error: 'AISSTREAM_API_KEY not set — free signup at https://aisstream.io',
      connected: false,
      vessels: [],
    });
  }
  prune();
  return send(res, 200, {
    connected: ws != null && ws.readyState === WebSocket.OPEN,
    error: lastError,
    boundingBoxes: boundingBoxes(),
    vessels: [...vessels.values()],
  });
}
