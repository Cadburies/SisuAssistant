const TOKEN_KEY = 'sisu-nav.skToken';
const USER_KEY = 'sisu-nav.skUser';

export type Vessel = {
  id: string;
  name?: string;
  mmsi?: string;
  lat?: number;
  lon?: number;
  sog?: number;
  cog?: number;
  heading?: number;
  headingMag?: number;
  updatedAt: number;
};

export type Wind = {
  tws?: number;
  twd?: number;
  twa?: number;
  aws?: number;
  awa?: number;
  updatedAt?: number;
};

export type SkStatus = 'idle' | 'connecting' | 'live' | 'auth' | 'error';

export type SignalKSnapshot = {
  status: SkStatus;
  error?: string;
  selfId: string;
  self: Vessel;
  wind: Wind;
  vessels: Record<string, Vessel>;
  connected: boolean;
  authenticated: boolean;
  username: string;
};

type Listener = () => void;

function emptyVessel(id = ''): Vessel {
  return { id, updatedAt: 0 };
}

function streamUrl(httpUrl: string, token?: string): string {
  const u = new URL('/signalk/v1/stream', httpUrl);
  u.protocol = httpUrl.startsWith('https') ? 'wss:' : 'ws:';
  u.searchParams.set('subscribe', 'all');
  if (token) u.searchParams.set('token', token);
  return u.toString();
}

function asNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function applyPath(vessel: Vessel, wind: Wind, path: string, value: unknown): void {
  if (path === 'navigation.position' && value && typeof value === 'object') {
    const o = value as { latitude?: unknown; longitude?: unknown };
    const lat = asNum(o.latitude);
    const lon = asNum(o.longitude);
    if (lat != null) vessel.lat = lat;
    if (lon != null) vessel.lon = lon;
    return;
  }
  const n = asNum(value);
  switch (path) {
    case 'navigation.position.latitude':
      if (n != null) vessel.lat = n;
      break;
    case 'navigation.position.longitude':
      if (n != null) vessel.lon = n;
      break;
    case 'navigation.speedOverGround':
      if (n != null) vessel.sog = n;
      break;
    case 'navigation.courseOverGroundTrue':
      if (n != null) vessel.cog = n;
      break;
    case 'navigation.headingTrue':
      if (n != null) vessel.heading = n;
      break;
    case 'navigation.headingMagnetic':
      if (n != null) vessel.headingMag = n;
      break;
    case 'name':
      if (typeof value === 'string') vessel.name = value;
      break;
    case 'mmsi':
      if (value != null) vessel.mmsi = String(value);
      break;
    case 'environment.wind.speedTrue':
      if (n != null) wind.tws = n;
      wind.updatedAt = Date.now();
      break;
    case 'environment.wind.directionTrue':
      if (n != null) wind.twd = n;
      wind.updatedAt = Date.now();
      break;
    case 'environment.wind.angleTrueWater':
    case 'environment.wind.angleTrueGround':
      if (n != null) wind.twa = n;
      wind.updatedAt = Date.now();
      break;
    case 'environment.wind.speedApparent':
      if (n != null) wind.aws = n;
      wind.updatedAt = Date.now();
      break;
    case 'environment.wind.angleApparent':
      if (n != null) wind.awa = n;
      wind.updatedAt = Date.now();
      break;
    default:
      break;
  }
}

export class SignalKClient {
  private listeners = new Set<Listener>();
  private ws: WebSocket | null = null;
  private httpUrl = '';
  private token = localStorage.getItem(TOKEN_KEY) || '';
  private backoff = 1000;
  private reconnectTimer: number | null = null;
  private liveTimer: number | null = null;
  private raf = 0;
  private dirty = false;
  private snap: SignalKSnapshot = {
    status: 'idle',
    selfId: '',
    self: emptyVessel('self'),
    wind: {},
    vessels: {},
    connected: false,
    authenticated: !!localStorage.getItem(TOKEN_KEY),
    username: localStorage.getItem(USER_KEY) || 'Sisu',
  };

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): SignalKSnapshot => this.snap;

  connect(httpUrl: string): void {
    this.httpUrl = httpUrl.replace(/\/$/, '');
    this.open();
  }

  disconnect(): void {
    if (this.reconnectTimer != null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
  }

  async login(username: string, password: string): Promise<void> {
    localStorage.setItem(USER_KEY, username);
    const res = await fetch(`${this.httpUrl}/signalk/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      token?: string;
      message?: string;
      error?: string;
    };
    if (!res.ok || !body.token) {
      throw new Error(body.message || body.error || `login failed (${res.status})`);
    }
    this.token = body.token;
    localStorage.setItem(TOKEN_KEY, body.token);
    this.patch({ authenticated: true, username, error: undefined, status: 'connecting' });
    this.open();
  }

  logout(): void {
    this.token = '';
    localStorage.removeItem(TOKEN_KEY);
    this.patch({ authenticated: false, status: 'auth' });
    this.open();
  }

  private patch(partial: Partial<SignalKSnapshot>): void {
    this.snap = { ...this.snap, ...partial };
    this.schedule();
  }

  private schedule(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      for (const l of this.listeners) l();
    });
  }

  private open(): void {
    this.disconnect();
    if (!this.httpUrl) return;
    this.patch({ status: 'connecting', error: undefined, connected: false });
    let ws: WebSocket;
    try {
      ws = new WebSocket(streamUrl(this.httpUrl, this.token || undefined));
    } catch (e) {
      this.patch({ status: 'error', error: String(e) });
      this.armReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.backoff = 1000;
      this.patch({ connected: true });
      if (this.liveTimer != null) window.clearTimeout(this.liveTimer);
      this.liveTimer = window.setTimeout(() => {
        if (this.snap.status !== 'connecting') return;
        if (this.token) {
          // Authenticated; a quiet bus (no AIS/wind yet) is still live.
          this.patch({ status: 'live', authenticated: true, error: undefined });
        } else {
          this.patch({ status: 'auth', authenticated: false });
        }
      }, 2500);
    };
    ws.onmessage = (ev) => {
      this.onMessage(String(ev.data));
    };
    ws.onerror = () => {
      /* onclose handles retry */
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.patch({ connected: false });
      this.armReconnect();
    };
  }

  private armReconnect(): void {
    if (this.reconnectTimer != null) return;
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 1.6, 15000);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, wait);
  }

  private onMessage(raw: string): void {
    let msg: {
      self?: string;
      context?: string;
      updates?: Array<{ values?: Array<{ path: string; value: unknown }> }>;
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.self && !this.snap.selfId) {
      this.patch({
        selfId: msg.self,
        self: { ...this.snap.self, id: msg.self },
        ...(this.token
          ? { status: 'live' as const, authenticated: true, error: undefined }
          : {}),
      });
    }
    if (!msg.updates) return;
    this.dirty = true;
    const selfId = this.snap.selfId;
    const vessels = { ...this.snap.vessels };
    let self = { ...this.snap.self };
    const wind = { ...this.snap.wind };
    const ctx = msg.context || selfId;
    const isSelf = !ctx || ctx === 'vessels.self' || ctx === selfId;
    const target = isSelf ? self : { ...(vessels[ctx] || emptyVessel(ctx)), id: ctx };
    for (const upd of msg.updates) {
      for (const v of upd.values || []) {
        if (!v || !v.path) continue;
        applyPath(target, isSelf ? wind : {}, v.path, v.value);
        target.updatedAt = Date.now();
      }
    }
    if (isSelf) self = target;
    else vessels[ctx] = target;
    if (this.liveTimer != null) {
      window.clearTimeout(this.liveTimer);
      this.liveTimer = null;
    }
    this.snap = {
      ...this.snap,
      status: 'live',
      connected: true,
      authenticated: true,
      self,
      wind,
      vessels,
      error: undefined,
    };
    if (this.dirty) {
      this.dirty = false;
      this.schedule();
    }
  }
}

export const sk = new SignalKClient();
