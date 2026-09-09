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
WebSocket** — the API never proxies it.

## 1. Where it runs

| Component | Interim (Mac, `../OPS.md` §7) | Target (F8, issue #6) |
|---|---|---|
| App (`sisu-nav-api`) | `http://<mac-lan-ip>:8088` | `http://192.168.0.21:8088` |
| `tileserver-gl` | `:8087` | `:8087` |
| Signal K (upstream, not part of this compose) | `:3000` | `:3000` |

Both targets are built from the **same source** (`sisu-nav/`), the only
difference is which compose file brings them up:

- `homeassistant/docker-compose.mac.yml` — interim, `network_mode` per-service
  port mapping (`8088:8088`, `8087:8080`).
- `homeassistant/docker-compose.yml` — F8 shape, `network_mode: host` (ports
  are the container's own — `8088`, `8087` directly).

Bring-up (either file — swap the filename):

```bash
cd homeassistant
docker compose -f docker-compose.mac.yml up -d --build sisu-nav-api tileserver-gl
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
| `SISU_TILES_DIR` | `/data/tiles` | Root of the tiles volume (see §4) |
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
| `MAPTILER_API_KEY` | `maptiler_api_key` | MapTiler Satellite offline SKU |
| `MAXAR_API_KEY` | `maxar_api_key` | Maxar official export |
| `PLANET_API_KEY` | `planet_api_key` | Planet official export |
| `MAPBOX_ACCESS_TOKEN` | `mapbox_access_token` | Mapbox Raster Tiles API v4 — a normal public token works. Also used for the live "Mapbox Satellite" basemap toggle (#116, `/api/config`'s `mapboxToken` field) — unlike the other keys in this table, that field is deliberately sent to the browser, same trust model as any normal web map's use of a Mapbox token |
| `GOOGLE_MAPS_API_KEY` | `google_maps_api_key` | Live **Google Satellite** basemap (#116). Enable Map Tiles API. Presence is exposed as `/api/config.googleConfigured`; the key itself is only sent to the browser after `GET /api/basemaps/google` creates a session (Google requires it on every tile URL) |
| `AZURE_MAPS_SUBSCRIPTION_KEY` | `azure_maps_subscription_key` | Live **Azure Maps Imagery** basemap (#126, replaces retired Bing Maps Basic). Gen2 (G2) Azure Maps account; key is sent to the browser like Mapbox (`/api/config.azureMapsKey`) to build `microsoft.imagery` XYZ URLs |

These come from `homeassistant/secrets.yaml` (gitignored) via
`scripts/gen-docker-env.sh`, which writes `homeassistant/.env` (also
gitignored, regenerated — never hand-edit it). Re-run that script any time
you change one of these keys, then `docker compose up -d` to pick it up.
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

## 4. Tiles

`SISU_TILES_DIR` (`../sisu-nav/tiles` on the host, mounted **read-write** —
the harvester writes into it from inside the same container) has three
kinds of content:

- **`tiles/manual/`** — drop-in `.mbtiles` / `.pmtiles` files (issue #76).
  `tileserver-gl` runs in directory mode with no operator config; new files
  under `tiles/` are picked up without a compose restart, and
  `/api/tilesets` walks the tree so the web app's layer list updates too.
- **`tiles/{nautical,satellite,bathymetry}/<provider>/<region>/<date>/`** —
  dated harvests written by `api/harvest/` (issue #80) per the provider
  registry `api/providers.yaml`. Mapbox/Google/Bing/Apple are allowed as
  `access: secret` providers there — Sisu Assist is personal/non-commercial
  and has knowingly accepted the ToS exposure that comes with caching their
  tiles; see `api/providers.yaml`'s header comment for the full reasoning
  before adding a new one.
- Bathymetry is presently a **floor only** (issue #97) — no live bathymetry
  provider is wired yet (tracked as #98/#99/#100); the tree exists so those
  issues have somewhere to land tiles.

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
docker compose -f homeassistant/docker-compose.mac.yml config   # or docker-compose.yml on F8

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
