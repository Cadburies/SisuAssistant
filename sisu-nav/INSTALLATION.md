# Sisu Nav — Installation

> Deploy doc for the `sisu-nav/` cockpit app. For what the UI does, see
> [USER_GUIDE.md](USER_GUIDE.md). For the API/plugin architecture, see
> [DEVELOPER.md](DEVELOPER.md). For the vessel-wide picture (Marine Board,
> HA Green, network), see the root [`INSTALLATION.md`](../INSTALLATION.md)
> and [`NETWORK.md`](../NETWORK.md).

Sisu Nav is **not** Home Assistant and **not** a Signal K plugin. It's a
standalone Docker service (static React SPA + a small Node API) that the
browser talks to directly, plus a `tileserver-gl` sidecar for offline map
tiles. Live nav data (position, wind, AIS) goes **browser → Signal K
WebSocket**. On the plain HTTP page that connection is direct to port 3000.
The HTTPS page proxies `/signalk` and `/data` so the browser can stay on
one secure origin (device GPS is refused on plain HTTP).

## 1. Where it runs

Live host is the **F8** (`192.168.0.21`). `docker-compose.mac.yml` is rollback only.

| Component | Live (F8) |
|---|---|
| App (`sisu-nav-api`) | `http://192.168.0.21:8088` and `https://192.168.0.21:8443` (Follow me) |
| `tileserver-gl` | `http://192.168.0.21:8087` |
| Signal K (upstream, not part of this compose) | `http://192.168.0.21:3000` |

Bring-up is `homeassistant/docker-compose.yml` (`network_mode: host`) via `./scripts/f8-deploy.sh`. Rollback Mac compose uses per-service port mapping (`8088:8088`, `8087:8080`).

```bash
# On F8 (after ./scripts/f8-deploy.sh from this repo)
cd /Volume1/docker/SisuAssistant/homeassistant
/Volume1/@apps/DockerEngine/dockerd/bin/docker-compose -f docker-compose.yml up -d --build sisu-nav-api tileserver-gl
```

`--build` matters: `sisu-nav-api` has no pre-built image, it's built from
`sisu-nav/api/Dockerfile` on every `up`. **A `git pull`/commit alone does not
change the running container** — rebuild (`docker compose build sisu-nav-api`)
and recreate (`up -d --no-deps sisu-nav-api`) after any change under
`sisu-nav/`, same as any other locally-built compose service.

## 2. Build

`api/Dockerfile` is a two-stage build, driven entirely by compose's
`context: ../sisu-nav` / `dockerfile: api/Dockerfile`:

1. **`web` stage** (`node:22-alpine`): `npm ci` in `web/`, then
   `npm run build` (`tsc --noEmit && vite build`) → static assets in
   `web/dist`.
2. **Runtime stage** (`node:22-alpine`): `npm ci --omit=dev` in `api/`, copies
   `server.mjs` and each API feature directory (`weather/`, `harvest/`,
   `route/`, `roses/`, `ensemble/`, `ais-global/`, `hazards/`, `basemaps/`,
   `marine/`), `polar/`, `providers.yaml`, and the
   built web assets from stage 1 into `./public`. Runs as the non-root
   `node` user.

No separate `npm install` step is needed outside Docker — there is no
bind-mount of source into the running container, so local `node_modules`
only matter for editor tooling / `tsc --noEmit` during development.

`CMD` runs `node --experimental-sqlite server.mjs` — the flag is required on
Node 22 for `node:sqlite`, used by the tile harvester
(`api/harvest/mbtiles.mjs`); it's baked into the image, not something you
need to pass yourself.

## 3. Environment variables

Set in the compose file's `environment:` block, not `.env` directly for most
of them — only the secret-gated ones below are meant to vary per host.

| Var | Default | Meaning |
|---|---|---|
| `SISU_NAV_PORT` | `8088` | HTTP port `server.mjs` listens on |
| `SISU_NAV_TLS_PORT` | `8443` | HTTPS port for Follow me. The cert is generated once in `/data/state/tls` (`SISU_NAV_TLS_SAN` defaults to `IP:192.168.0.21,IP:127.0.0.1,DNS:localhost`) |
| `SISU_TILES_DIR` | `/data/tiles` | Root of the tiles volume (see §4) |
| `SISU_IMPORT_DIR` | `/data/import` | Inbox for USB/Finder chart drop-in (#108). Compose bind-mounts `tiles/inbox` here on Mac; on F8 override with the USB/NAS circumnavigation folder |
| `SISU_NAV_HOST` | `mac` or `f8` | Import size warn: Mac refuses huge selections unless `force`; F8 does not warn |
| `SISU_IMPORT_WARN_BYTES` | `34359738368` (Mac) / `0` (F8) | Override the Mac ~32 GB warn; `0` disables |
| `SIGNALK_URL` | derived from request `Host` header, `:3000` | Overrides what `/api/config` tells the browser to connect to for Signal K |
| `TILESERVER_URL` | derived from request `Host` header, `:8087` | Overrides what `/api/config` tells the browser for `tileserver-gl` |
| `TZ` | `America/Tortola` | Container timezone (harvest job timestamps, log lines) |

`SIGNALK_URL` / `TILESERVER_URL` are rarely needed — the default (same host
the browser used to reach `sisu-nav-api`, standard port) is normally right
for both Mac and F8.

### Secret-gated harvest providers (optional, issue #80)

Some dated tile-harvest providers in `api/providers.yaml` (`access: secret`)
refuse to run until their key is set:

| Env var | `secrets.yaml` key | Provider |
|---|---|---|
| `MAPTILER_API_KEY` | `maptiler_api_key` | MapTiler Satellite offline SKU **and** Ocean harvest (#106) |
| `MAXAR_API_KEY` | `maxar_api_key` | Maxar official export |
| `PLANET_API_KEY` | `planet_api_key` | Planet official export |
| `MAPBOX_ACCESS_TOKEN` | `mapbox_access_token` | Mapbox Raster Tiles API v4 — a normal public token works. Also used for the live "Mapbox Satellite" basemap toggle (#116, `/api/config`'s `mapboxToken` field) — unlike the other keys in this table, that field is deliberately sent to the browser, same trust model as any normal web map's use of a Mapbox token |
| `GOOGLE_MAPS_API_KEY` | `google_maps_api_key` | Live **Google Satellite** basemap (#116). Enable Map Tiles API. Presence is exposed as `/api/config.googleConfigured`; the key itself is only sent to the browser after `GET /api/basemaps/google` creates a session (Google requires it on every tile URL) |
| `AZURE_MAPS_SUBSCRIPTION_KEY` | `azure_maps_subscription_key` | Live **Azure Maps Imagery** basemap (#126, replaces retired Bing Maps Basic). Gen2 (G2) Azure Maps account; the key stays on the server — `sisu-nav-api` proxies `microsoft.imagery` tiles at `/api/basemaps/azure/{z}/{x}/{y}`; `/api/config` only reports `azureConfigured` (#168) |

These come from `homeassistant/secrets.yaml` (gitignored) via
`scripts/gen-docker-env.sh`, which writes `homeassistant/.env` (also
gitignored, regenerated — never hand-edit it). `.env` is **compose
injection at container start**, not baked into the image.

The **Settings** panel (#123) is the other in-app path: one list of every
key Sisu Nav can use, saved to a **gitignored local file**
(`sisu-nav/api/data/keys.local.json`, mounted at `/data/keys` in the
container). That file is **not** `secrets.yaml`. Precedence is **local
store first, then** `process.env` (compose / `secrets.yaml`). Clearing a
Settings row drops the local override and falls back to env.

The Charts panel can still paste a harvest key (MapTiler /
Maxar / Planet) into the UI (#102). That writes `secrets.yaml`,
regenerates `.env`, and updates the running API — no compose recreate.
Hand-edit + `gen-docker-env.sh` still works if you prefer the terminal.
If both Settings and `secrets.yaml` set the same key, Settings wins until
you Clear local.

Leave any of them `CHANGE_ME`/unset and the matching provider stays greyed
in the Charts panel — this is expected, not a bug, until you actually have
an account.

### Wind roses (issue #86)

`roses/index.mjs` reads this boat's own Influx `Sisu_1m` bucket — no
external API:

| Env var | Source |
|---|---|
| `INFLUXDB_TOKEN` | `secrets.yaml` → `InfluxDB` (same token Grafana uses) |
| `INFLUXDB_ORG` | `secrets.yaml` → `influxdb_org` |
| `INFLUXDB_URL` | `http://influxdb:8086` (Mac, compose service name) or `http://127.0.0.1:8086` (F8, host network) |
| `INFLUXDB_ROSES_BUCKET` | optional, defaults to `Sisu_1m` |

Also generated into `homeassistant/.env` by `gen-docker-env.sh`. The browser
never holds this token — roses are queried server-side and returned as
pre-aggregated cells.

No env var is needed for weather (`api/weather`), routing (`api/route`), or
ensemble (`api/ensemble`) — all three call the public, keyless Open-Meteo
APIs directly.

### Global AIS overlay (issue #115)

`ais-global/index.mjs` holds a persistent WebSocket to AISStream.io — a
free (signup required) global crowd-sourced AIS feed, distinct from and
complementary to Signal K's own local-receiver `ais` layer:

| Env var | `secrets.yaml` key | Source |
|---|---|---|
| `AISSTREAM_API_KEY` | `aisstream_api_key` | Free signup at https://aisstream.io |
| `AISSTREAM_BOUNDING_BOXES` | optional | JSON `[[[lat,lon],[lat,lon]], ...]` override; defaults to a Western Atlantic/Caribbean box — override if the vessel cruises elsewhere. AIS is a very high-volume global feed; don't set this to the whole world for a single personal receiver-equivalent |

Leave `AISSTREAM_API_KEY` `CHANGE_ME`/unset and the layer's panel reports
it's not configured rather than connecting — no silent no-op.

### Community wind roses (issue #88)

Opt-in shared roses use the existing **Sisu Mate** Supabase project.
`sisu-nav-api` holds `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
`SUPABASE_SERVICE_ROLE` (never the browser). Paste the service role from
the Supabase dashboard (Settings → API) into `secrets.yaml`; without it,
uploads stay off and the Community chip still reads public cells
(`boat_count >= 3`). Schema: `sisu-nav/api/roses/migrations/`.

### Anchor-spot wind roses (issue #187)

Detection runs regardless — every `ANCHOR_ROSES_EVERY_MIN` (15) minutes from
Influx `Sisu_1m` — and keeps its store at `SISU_STATE_DIR`
(`/data/state` ← `../sisu-nav/state`). That directory is **box runtime
state**: `f8-deploy.sh` and `stack-drift.sh` exclude it, never push over it.

Mirroring to **SisuMate** (same Supabase project) needs, once:

1. Apply `sisu-nav/api/roses/migrations/002_anchor_spots.sql` in the
   Supabase SQL editor.
2. `secrets.yaml`: `supabase_service_role` (Settings → API) and
   `sisu_boat_id` = Sisu's `boats."supabaseId"` (Table editor → boats).
   Then `./scripts/f8-deploy.sh --secrets` and recreate `sisu-nav-api`.
   Both can instead be pasted in Sisu Nav **Settings** (no recreate).

Until then the panel reads "local only" and spots wait on the F8; they're
sent on the first sync after setup (`ANCHOR_ROSES_SYNC_MIN`, 60). Tuning env
(optional): `ANCHOR_SPOT_MERGE_M` (100), `ANCHOR_STAY_RADIUS_M` (150),
`ANCHOR_MIN_STAY_MIN` (45), `ANCHOR_SOG_MAX_KN` (1.5), `ANCHOR_SWING_MIN_DEG`
(6), `ANCHOR_ROSES_BACKFILL_DAYS` (120), `ANCHOR_ROSES_DISABLE=1`.

## 4. Tiles

`SISU_TILES_DIR` (`../sisu-nav/tiles` on the host, mounted **read-write** —
the harvester writes into it from inside the same container) has four
kinds of content. The API container starts as root long enough to
`chmod a+rwX` that tree (TOS bind-mounts often show as `root:root` 755,
which made `USER node` fail with `EACCES` on mkdir — #137), then drops to
`node`.

- **`tiles/inbox/`** — USB/Finder **inbox** (#108). Drop `.mbtiles` /
  `.pmtiles` / XYZ folders here, then pick **which folder and which files**
  in Charts → Add from USB. Mac: only a small subset (circumnavigation dump
  will fill the disk). F8: bind-mount the USB/NAS dump over `/data/import`
  instead of this folder and import everything. Binaries are gitignored;
  keep `README.md`.
- **`tiles/manual/<slug>/`** — imported sets (`meta.json` + archive).
  `tileserver-gl` is directory-mode and reloads when files appear — no
  compose restart. Layout and `meta.json.example` are in that folder's
  README. Nautical/satellite imports join the Charts list for views they cover, not a
  Layers overlay.
- **`tiles/{nautical,satellite,bathymetry}/<provider>/<region>/<date>/`** —
  dated harvests written by `api/harvest/` (issue #80) per the provider
  registry `api/providers.yaml`. Mapbox/Google/Bing/Apple are allowed as
  `access: secret` providers there — Sisu Assist is personal/non-commercial
  and has knowingly accepted the ToS exposure that comes with caching their
  tiles; see `api/providers.yaml`'s header comment for the full reasoning
  before adding a new one.
- Bathymetry harvests (#97–#106) live under `tiles/bathymetry/` — not a
  floor-only stub. USB bathymetry drop-ins still go through inbox →
  `manual/<slug>/` with `kind: bathymetry`.

## 5. Signal K auth

This vessel's Signal K server requires login (`allow_readonly: false`). The
web app authenticates directly against Signal K's HTTP API from the browser
and puts the resulting JWT on the WebSocket URL — `sisu-nav-api` is never in
that path and never sees SK credentials. Nothing to configure server-side
for this; the login form appears in the app's status bar until a session
authenticates.

## 6. Verify / smoke

```bash
# Compose topology + service definitions
docker compose -f homeassistant/docker-compose.yml config   # F8 live; .mac.yml is rollback

# Container up
docker ps --format '{{.Names}}\t{{.Status}}' | grep sisu-nav

# API health + config the browser will receive
curl -sS http://<host>:8088/api/health
curl -sS http://<host>:8088/api/config

# Tile catalog (empty tilesets: [] is valid on a fresh install)
curl -sS http://<host>:8088/api/tilesets

# App itself
curl -sS -o /dev/null -w '%{http_code}\n' http://<host>:8088/
```

Always run `./scripts/scan_secrets.sh` before committing any change under
`sisu-nav/` — same gate as the rest of the repo.

## Revision history

| Ver | Date | Notes |
|---|---|---|
| 1.0 | 2026-09-08 | Initial install doc (#112) — build, env, tiles, SK auth, verify. |
| 1.1 | 2026-09-09 | USB/Finder chart inbox (`SISU_IMPORT_DIR`, Mac subset vs F8 dump) (#108). |
| 1.2 | 2026-09-16 | Live host is F8; `docker-compose.mac.yml` is rollback only. |
| 1.3 | 2026-09-19 | Settings panel local key store (`SISU_KEYS_FILE`, #123). |
| 1.4 | 2026-09-20 | Harvest tile dir chmod + drop to `node` (#137 EACCES mkdir). |
| 1.5 | 2026-10-03 | USB import and harvest keys are on the Charts panel (#185). |
| 1.6 | 2026-10-03 | HTTPS on 8443 for device GPS. That listener proxies `/signalk` and `/data` (#188). |
