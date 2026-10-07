# Sisu Nav — Developer Guide

> API routing + plugin architecture, and how to add to either without
> touching `App.tsx`. For deploy, see [INSTALLATION.md](INSTALLATION.md).
> For what the UI does, see [USER_GUIDE.md](USER_GUIDE.md).

## Shape of the app

```
sisu-nav/
  api/            Node API (plain http, no framework) — see §2
    server.mjs    routing + static SPA host
    <feature>/    one dir per API feature (weather, harvest, route, roses, ensemble, marine, ...)
    providers.yaml  tile-harvest provider registry
    Dockerfile
  web/            React SPA (Vite) — see §3
    src/app/      shell: App.tsx, plugin.ts, loadPlugins.ts, config.ts, sk.ts, units.ts
    src/plugins/  one dir per feature, glob-loaded — see §3.1
```

Live nav data (position, wind, AIS) is **browser → Signal K WebSocket**,
not proxied through the API. The API's job is: host the built SPA, serve
the tile catalog, and answer a handful of `/api/*` routes for features that
need a server (external HTTP calls, Influx queries, or state that outlives
a page load).

## 1. Adding a plugin — worked example

This is the one recipe that keeps `App.tsx` untouched, which is a hard rule
(see `CLAUDE.md`'s Sisu Nav parallel-safety notes) so multiple issues can
land plugins in the same wave without merge conflicts on one shared file.

1. Create `web/src/plugins/<id>/index.ts` exporting a `plugin: NavPlugin`
   (shape in §3). `loadPlugins.ts` glob-loads every
   `plugins/*/index.ts` at build time — nothing else needs to import it.
2. If it's a map layer: call `registerLayer({ id, ready: true, ... })` in
   that same `index.ts`, as a side effect of the module loading (see §3.2).
   If the layer id doesn't exist yet in `layers.ts`'s `CATALOG`, add a stub
   row there first (`ready: false`) — later plugins flip it on, they don't
   invent new catalog rows from inside a feature dir (`layers.ts` is a
   single-owner hotspot, see `CLAUDE.md`).
3. If it needs a server route: add `api/<feature>/index.mjs` exporting
   `handle(req, res, url)`, then wire **one line** into `server.mjs`
   (import + `if (url.pathname.startsWith('/api/<feature>'))`).
4. If the API module is new, add a `COPY api/<feature> ./<feature>` line to
   `api/Dockerfile` next to its siblings.
5. Update `sisu-nav/README.md`'s plugin table (one row), and
   `USER_GUIDE.md` / `DEVELOPER.md` / `INSTALLATION.md` per the cascade in
   `CLAUDE.md`'s "Sisu Nav docs" section.

That's the whole surface. No plugin registry to edit by hand, no router
config, no `App.tsx` diff.

## 2. API (`api/`)

Plain `node:http`, no Express/Fastify — see `server.mjs`. JSON responses use
`cache-control: no-store` and `access-control-allow-origin: *`
(the SPA is same-origin in practice). `POST /api/signalk/session` is the
exception: it returns a Signal K token and sends no CORS header (#190).

### Routing (`server.mjs`)

```
/api/health              GET   liveness check
/api/signalk/session     POST  boat account token from SignalKUser/SignalKPwd; no CORS (#190)
/api/config              GET   { signalkHttp, tileserver, mapboxToken, googleConfigured, azureConfigured }
/api/tilesets             GET   walks SISU_TILES_DIR for .mbtiles/.pmtiles (id, file, format, kind, label, imported, tileSize, bounds, minZoom, maxZoom, provider, providerLabel, sourceDate, acquiredAt)
/api/weather/*      -> weather/index.mjs   (#77)
/api/harvest/*      -> harvest/index.mjs   (#80)
/api/route/*        -> route/index.mjs     (#78)
/api/roses/*        -> roses/index.mjs     (#86; anchor spots #187)
/api/ensemble/*     -> ensemble/index.mjs  (#91)
/api/ais-global/*   -> ais-global/index.mjs (#115)
/api/hazards/*      -> hazards/index.mjs   (#118)
/api/basemaps/*     -> basemaps/index.mjs  (#116)
(any other /api/*)  -> 404 JSON {"error":"unknown api route"} — never the SPA index.html (#171)
/api/marine/*       -> marine/index.mjs    (#94 waves, #95 currents)
/api/pois           -> pois/index.mjs      (#119 Overpass viewport POIs)
/api/aircraft       -> aircraft/index.mjs  (#120 adsb.lol)
/api/satellites/tle -> satellites/index.mjs (#121 CelesTrak TLE cache)
/api/settings/*     -> settings/index.mjs (#123 local key store)
(anything else)      -> static file from ./public, falling back to index.html (SPA routing)
```

Each feature module owns everything under its prefix — `server.mjs` never
branches inside a feature's own paths, it just dispatches once.

### Feature modules

| Module | Endpoints | What it does | External dep |
|---|---|---|---|
| `weather/` | `GET /api/weather/models`, `GET /api/weather/forecast` | Multi-model wind forecast (GFS/ECMWF IFS/ICON/GEM), one Open-Meteo call, `cell_selection=sea` | Open-Meteo (keyless) |
| `harvest/` | `GET /providers`, `POST /estimate`, `GET /coverage`, `POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/resume`, `POST /secrets`, `DELETE /secrets/:env`, `GET /import/inbox`, `POST /import`, `GET /import/sets` | Dated tile harvest against `providers.yaml`; resumable jobs; harvest keys write `secrets.yaml` + regenerate `.env` and `process.env` (#102). USB/Finder import (#108) lists a mounted inbox (`SISU_IMPORT_DIR`), copies selected files into `tiles/manual/<slug>/`, packs XYZ with `mbtiles.mjs`. `GET /coverage` (#101) sample-probes BlueTopo at a lon/lat so empty Atlantic tiles don't count as US waters | Per-provider (EOX, GIBS, Esri, BlueTopo WMTS, GEBCO WMS, Seascape XYZ, secret-gated MapTiler/Maxar/Planet); import is local files only — no Navionics decoder |
| `route/` | `GET /modes`, `GET /polars`, `GET /committed`, `POST /plan`, `POST /commit` | Isochrone routing over a boat polar + forecast wind; three `MODES` (`eta`, `modelAgreement`, `ensembleAgreement`); `commit` writes a route to Signal K | Open-Meteo (wind), Signal K (route storage via `sk.mjs`) |
| `roses/` | `GET /spec`, `GET /`, `GET /community`, `POST /share`, `GET /anchor-spots`, `POST /anchor-spots/run[?sync=1]`, `POST /anchor-spots/community` (`{optIn}`), `POST /anchor-spots/settings` (`{berths}`) | This-boat roses from Influx; opt-in community share/read via Supabase (#88). Anchor-spot roses (#187): `anchor.mjs` detects anchored stays (pure), `anchor-store.mjs` keeps hour rows + spots in `$SISU_STATE_DIR/anchor-roses.json`, runs on a timer started from `server.mjs`, mirrors to Supabase `anchor_rose_hours` / `anchor_spots`; non-swinging / bow-off-wind stays are kept as `kind: 'berth'` (listed + synced only with the berths opt-in, never community); when opted in, also feeds anchor spots into the community tables as geohash-7 cells. All Supabase access is **user-level** (`supabase-auth.mjs`): signs in as the boat's own SisuMate user (email + password + publishable key), resolves the boat via `accessible_boat_ids()`, writes through RLS. Community = each boat upserts its own `wind_rose_uploads` rows; the trigger `wind_rose_uploads_merge` rebuilds `wind_rose_cells`. No service role; the browser never holds credentials. `GET /anchor-spots` → `status.boatId` and `status.signedIn.boatId` (boats."supabaseId"), `status.lastSyncAt`, `status.lastSyncError` — the SisuMate side reads the same rows as that boat | Influx (`Sisu_1m`); Supabase PostGIS |
| `ensemble/` | `GET /forecast` | ECMWF IFS ENS (51-member) spaghetti data; clustered (control + every 5th member) by default, `?deep=1` for all 51 | Open-Meteo Ensemble API (keyless) |
| `ais-global/` | `GET /vessels` | Tier-4 internet AIS overlay, distinct from Signal K's local-receiver `ais` layer; holds one persistent server-side WebSocket to AISStream.io (Node 22's native `WebSocket` global, no dependency), browser polls a snapshot every ~60s | AISStream.io (secret-gated: `AISSTREAM_API_KEY`) |
| `hazards/` | `GET /cables` | Anchoring hazards — submarine cable + landing-point GeoJSON, fetched live (not bundled), 30-day in-process cache with stale-serve-on-failure | TeleGeography's public API (keyless; CC BY-NC-SA 3.0) |
| `basemaps/` | `GET /google`, `GET /azure/{z}/{x}/{y}` | Brokers the Google Map Tiles session; **proxies Azure Maps imagery tiles** so the subscription key stays server-side (#168). Mapbox's public token goes out on `/api/config` (plain XYZ) | Google Map Tiles API |
| `marine/` | `GET /models`, `GET /forecast`, `GET /currents` | Waves / swell Hs (#94, ECMWF WAM 0.25°) and surface currents (#95, `meteofrance_currents` SMOC, knots, direction-towards); both `cell_selection=sea` | Open-Meteo Marine API (keyless) |
| `settings/` | `GET /keys`, `POST /keys` | Central API-key panel (#123). GET returns configured y/n + masked preview, never the raw value. POST writes `api/data/keys.local.json` (gitignored, volume `/data/keys`). Local store overlays `process.env` so harvest / roses / AIS / live basemaps pick it up without a compose recreate. Stub rows (Bing, Apple) refuse POST. | None (file on disk) |

`weather`, `route`, `ensemble`, and `marine` all call Open-Meteo but are
intentionally separate modules — a single-run deterministic wind forecast
(`weather`), a routing engine that *consumes* wind (`route`), a
probabilistic ensemble overlay (`ensemble`), and marine Hs/currents overlays
(`marine`) are different enough concerns that folding them together would
make each harder to reason about. Don't merge them for "less code" — see
`CLAUDE.md`'s reuse-vs-clarity balance.

`providers.yaml` is the single source of truth for what the Charts panel
can harvest — `access: free | free-ish | secret` and `harvestable`
gate what shows up and what needs a key; see comments at the top of the
file before adding a provider. Mapbox/Google/Bing/Apple are allowed
(`access: secret`) — this is a personal, non-commercial, currently-private
project that has knowingly accepted the ToS exposure those four carry for
tile caching; read the reasoning in `providers.yaml`'s header before
touching that policy.

Not every feature needs its own `api/<feature>/` module. The Mapbox live
basemap reuses `/api/config` (`mapboxToken`) — a `pk.` token is a public,
URL-restricted tile token, **deliberately client-exposed** (unlike every
`secretEnv` harvest key, which never leaves the server). The Azure Maps
subscription key is an account secret, so `/api/config` only sends
`azureConfigured` and tiles go through `GET /api/basemaps/azure/{z}/{x}/{y}` (#168). Google still has
`api/basemaps/` because it needs a session-token round-trip before any
`{z}/{x}/{y}` URL exists; `/api/config` only exposes a cheap
`googleConfigured` presence flag so the Charts list can mark the row as needing a key
without spending an upstream call. Don't copy the client-exposed-token
pattern for a key that's meant to stay secret.

## 3. Web (`web/src/`)

### 3.1 The plugin contract (`app/plugin.ts`)

```ts
export type PluginSlot = 'map' | 'panel' | 'none';

export type PluginProps = {
  sk: SignalKSnapshot;   // live Signal K state (see app/sk.ts)
  config: RuntimeConfig; // from /api/config
};

export type NavPlugin = {
  id: string;
  title: string;
  slot: PluginSlot;
  order?: number;   // sidebar stack order, lower first, missing sorts last
  aside?: boolean;  // false = map chrome (e.g. the Layers button) — always
                     // mounted, never listed in the stack editor (#109)
  Component?: ComponentType<PluginProps>;
};
```

`slot: 'map'` is the chart itself (exactly one plugin claims it — `map`).
`slot: 'panel'` is a right-hand-stack entry; `aside: false` opts a panel out
of the stack-editor list entirely (it renders inside `<main>` as map chrome
instead of `<aside>`  — the Layers picker is the only current example).
`slot: 'none'` mounts nothing itself; `layout`'s plugin object exists only
so the id shows up in plugin listings, the actual `LayoutGear` component is
mounted directly from `App.tsx`'s aside header (a pre-existing, deliberate
exception — not a pattern to copy for a new feature).

### 3.2 Glob loading (`app/loadPlugins.ts`)

```ts
const modules = import.meta.glob('../plugins/*/index.ts', { eager: true });
```

Vite resolves this at build time into a static list of imports — every
`plugins/<id>/index.ts`'s `plugin` (or default) export gets collected,
filtered to valid `NavPlugin`s, and sorted by `order` then `id`. This is
*why* `App.tsx` never needs a per-feature edit: adding a new `plugins/<id>/`
directory is enough for it to be picked up. A module's top-level code (e.g.
a `registerLayer()` call) runs once, at import time, as a side effect —
that's the mechanism `ensemble/index.ts` and `roses/index.ts` use to
un-grey their map layer without any explicit "plugin init" hook.

### 3.3 Map layers (`plugins/map/layers.ts`, `registry.ts`)

`layers.ts` is the Layers-picker's data model — **overlays only** (wind,
AIS, bathy, currents, cables, OpenSeaMap marks, saved chart coverage, …). The **basemap** is one
choice in `plugins/map/basemap.ts` (`auto`, or `source:<id>` with an optional
file), written by the Charts list (#185). `plugins/map/sources.ts` builds one
row per named chart (live/harvest twins, import families). A manual folder
whose name contains `arcgis`, `bingsat`, or `googlesat` joins the Esri,
Azure, or Google row (#186). `availability.ts`
keeps the list to this view. `MapView` paints only the chosen source’s files
that overlap the view, with the live twin underneath. `imported` and `bathy`
are `slot: 'none'`; USB import is the Charts drawer and depth is the
disclosure on that panel. Do not add live basemaps or imported charts back
into `CATALOG`.

`layers.ts` is a `CATALOG: LayerDef[]` array
(`{ id, label, ready, mutex?, defaultOn? }`), plus:

- `registerLayer(patch)` — merge a patch into an existing catalog row by
  `id` (used to flip `ready: false → true`, never to invent a brand-new id
  from outside `layers.ts` itself — add the stub row there first).
- `isLayerOn(id)` / `toggleLayer(id)` / `setLayerOn(id, on)` — read/write
  visibility, persisted to `localStorage`.
- `mutexHolder(group)` / `layerBlockReason(id)` — the mutex mechanism: at
  most one layer per `mutex` group can be on; `setLayerOn` refuses to
  enable a layer while another holds its group.
- `subscribeLayers(fn)` — React-friendly change notification (panels use
  this plus `useState` to re-render on toggle).

A plugin that paints on the map doesn't get the MapLibre instance as a
prop — instead `plugins/map/registry.ts` holds it in a module-level
singleton (`setNavMap`/`getNavMap`/`subscribeNavMap`), set once by the
`map` plugin itself and read by everyone else. This is what lets a panel
plugin (e.g. `ensemble`) paint/clear its own MapLibre source and layer
without `MapView.tsx` knowing anything about it.

### 3.4 Right-hand stack order (`plugins/map/side.ts`)

`resolveSide(plugins)` merges a persisted `{ order, hidden }` with whatever
plugins are actually loaded (a new plugin's id gets appended, not lost, if
the stored order predates it) and returns `{ stack, visible, hidden,
hiddenIds }` for `App.tsx` to render. `LayoutGear` (§ above) is the only UI
for `movePlugin`/`setPluginHidden`; `isSideEditing`/`setSideEditing` is a
single shared edit-mode flag that `InstrumentsPanel` also reads, so its
own drag-and-edit UI activates in step with the stack editor rather than
needing a second toggle.

### 3.5 Units and Signal K (`app/units.ts`, `app/sk.ts`)

`units.ts` centralizes conversions/formatting (`fmt`, `fmtLat`, `fmtLon`,
`skSpeedKn`, angle helpers) — use these rather than re-deriving knots or
degree wrapping in a new panel. `sk.ts`'s `SignalKClient` (exported as
`sk`) owns the WebSocket connection, auth/login flow, and the reactive
snapshot (`SignalKSnapshot`) that `PluginProps.sk` is populated from every
render via `useSyncExternalStore` in `App.tsx`.

### 3.6 Styling a new plugin (`app/theme.ts`, `DESIGN.md`)

Every color in a plugin's `*.css` file is a token from `App.css`'s `:root`
(`--panel`, `--well`, `--line`, `--text`, `--muted`, `--gold`, `--cyan`,
`--red`, `--ok`, `--wait`) plus a matching `--glow-*` box-shadow for
hover/active states — see [DESIGN.md](DESIGN.md) for the full system and
the day/night theme (`theme.ts`, `getTheme`/`setTheme`/`subscribeTheme`).
**Never hardcode a hex color in a plugin's CSS** — a hardcoded color can't
follow the day/night toggle, which is exactly the bug this would reintroduce
(every plugin file already had this swept clean once).

## 4. Style notes for new API modules

- Match the existing `json(res, status, body)` helper pattern (JSON,
  `no-store`, CORS `*`) rather than introducing a new response helper per
  feature.
- Cache external-API responses in-process with a small `Map` + TTL (see
  `ensemble/index.mjs`, `weather/index.mjs`) rather than hitting Open-Meteo
  on every map pan — these are rate-limited public APIs.
- No GDAL, ever, in this container (see `providers.yaml`'s `noaa-enc` entry
  for why — S-57→MBTiles conversion is deliberately unimplemented rather
  than add that dependency).

## Revision history

| Ver | Date | Notes |
|---|---|---|
| 1.0 | 2026-09-08 | Initial developer doc (#114) — API routing, plugin contract, layer/side registries, add-a-plugin walkthrough. |
| 1.1 | 2026-09-09 | `marine/` waves / swell overlay (#94). |
| 1.2 | 2026-09-09 | `basemaps/` Google/Bing session broker (#116); `/api/tilesets` mtime for harvest fill refresh. |
| 1.3 | 2026-09-09 | Bing Maps Basic retired — live Microsoft imagery is Azure Maps XYZ (#126). |
| 1.4 | 2026-09-09 | `marine/` surface currents overlay (#95, SMOC). |
| 1.5 | 2026-09-09 | BlueTopo WMTS bathymetry harvest + overlay (#98). |
| 1.6 | 2026-09-09 | GEBCO WMS colour-elevation harvest (#99). |
| 1.7 | 2026-09-09 | Seascape Terrarium DEM + vector contours harvest (#100). |
| 1.8 | 2026-09-09 | Harvest key UI writes `secrets.yaml` + `.env` (#102). |
| 1.9 | 2026-09-09 | EMODnet/GMRT/Esri Ocean/MapTiler Ocean harvest (#103–#106). |
| 1.10 | 2026-09-09 | USB/Finder import plugin + `/api/harvest/import*` (#108). |
| 1.11 | 2026-09-09 | Charts dropdown is the basemap; Layers is overlays only (#127). |
| 1.12 | 2026-09-10 | Default floor is OSM; Carto dark_all watermarks without a key (#129). |
| 1.13 | 2026-09-10 | OpenSeaMap seamark overlay (`openseamap` plugin, Layers toggle) (#125). |
| 1.14 | 2026-09-10 | Remaining Layers: AIFS/GEFS (#92/#93), rain/clouds/radar/dust (#87), POI (#119), aircraft (#120), satellites (#121). |
| 1.15 | 2026-09-19 | `settings/` local key store + Settings plugin (#123). Precedence: `keys.local.json` then compose/`secrets.yaml`. |
| 1.16 | 2026-09-19 | Bathymetry coverage probe + Pin source (#101). |
| 1.17 | 2026-09-19 | NOAA Chart Display WMTS (#107); Google/Azure harvest, Apple live-only (#117); community roses (#88). |
| 1.18 | 2026-09-26 | Azure Maps imagery proxied via `/api/basemaps/azure/{z}/{x}/{y}`; `/api/config` sends `azureConfigured`, never the key (#168). Unknown `/api/*` → JSON 404 (#171). |
| 1.19 | 2026-10-03 | One Charts list for this view (#185). Imported and Bathymetry are no longer sidebar panels. |
| 1.20 | 2026-10-03 | Sailor zone folders join by product word. Saved Bing is on the Azure row. Import-all infers kind (#186). |
| 1.21 | 2026-10-03 | Anchor-spot wind roses: detection + store + SisuMate sync in `roses/anchor*.mjs`, timer from `server.mjs` (#187). |
| 1.22 | 2026-10-03 | HTTPS `:8443` for Follow me. On that listener `/signalk` and `/data` are same-origin proxies, and `/api/config` returns that origin (#188). |
| 1.23 | 2026-10-03 | Charts bands are live, harvested, and downloaded. A saved row does not turn on the live underlay (#189). |
| 1.24 | 2026-10-03 | `POST /api/signalk/session` signs in with `SignalKUser` / `SignalKPwd` and returns a token. The password stays on the server. The status-bar form shows only when that fails (#190). |
| 1.25 | 2026-10-03 | Saved chart coverage is the `chart-coverage` Layers row. The gold `harvest-bbox` boxes draw only while it is on (#191). |
