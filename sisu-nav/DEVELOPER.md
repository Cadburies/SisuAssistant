# Sisu Nav — Developer Guide

> API routing + plugin architecture, and how to add to either without
> touching `App.tsx`. For deploy, see [INSTALLATION.md](INSTALLATION.md).
> For what the UI does, see [USER_GUIDE.md](USER_GUIDE.md).

## Shape of the app

```
sisu-nav/
  api/            Node API (plain http, no framework) — see §2
    server.mjs    routing + static SPA host
    <feature>/    one dir per API feature (weather, harvest, route, roses, ensemble, ...)
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

Plain `node:http`, no Express/Fastify — see `server.mjs`. Every response is
JSON with `cache-control: no-store` and `access-control-allow-origin: *`
(the SPA is same-origin in practice, but kept permissive since nothing here
is auth-gated at this layer).

### Routing (`server.mjs`)

```
/api/health              GET   liveness check
/api/config              GET   { signalkHttp, tileserver } for the browser to connect to
/api/tilesets             GET   walks SISU_TILES_DIR for .mbtiles/.pmtiles
/api/weather/*      -> weather/index.mjs   (#77)
/api/harvest/*      -> harvest/index.mjs   (#80)
/api/route/*        -> route/index.mjs     (#78)
/api/roses/*        -> roses/index.mjs     (#86)
/api/ensemble/*     -> ensemble/index.mjs  (#91)
/api/ais-global/*   -> ais-global/index.mjs (#115)
(anything else)      -> static file from ./public, falling back to index.html (SPA routing)
```

Each feature module owns everything under its prefix — `server.mjs` never
branches inside a feature's own paths, it just dispatches once.

### Feature modules

| Module | Endpoints | What it does | External dep |
|---|---|---|---|
| `weather/` | `GET /api/weather/models`, `GET /api/weather/forecast` | Multi-model wind forecast (GFS/ECMWF IFS/ICON/GEM), one Open-Meteo call, `cell_selection=sea` | Open-Meteo (keyless) |
| `harvest/` | `GET /providers`, `POST /estimate`, `POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/resume` | Dated tile harvest against `providers.yaml`; resumable jobs, tracked in `jobs.mjs`, auto-resumes on container restart (`scanResumable()`) | Per-provider (EOX, GIBS, Esri, secret-gated MapTiler/Maxar/Planet) |
| `route/` | `GET /modes`, `GET /polars`, `GET /committed`, `POST /plan`, `POST /commit` | Isochrone routing over a boat polar + forecast wind; three `MODES` (`eta`, `modelAgreement`, `ensembleAgreement`); `commit` writes a route to Signal K | Open-Meteo (wind), Signal K (route storage via `sk.mjs`) |
| `roses/` | `GET /spec`, `GET /` | Historical wind-direction/speed distribution from this boat's own logged data, aggregated server-side | Influx (`Sisu_1m` bucket) |
| `ensemble/` | `GET /forecast` | ECMWF IFS ENS (51-member) spaghetti data; clustered (control + every 5th member) by default, `?deep=1` for all 51 | Open-Meteo Ensemble API (keyless) |
| `ais-global/` | `GET /vessels` | Tier-4 internet AIS overlay, distinct from Signal K's local-receiver `ais` layer; holds one persistent server-side WebSocket to AISStream.io (Node 22's native `WebSocket` global, no dependency), browser polls a snapshot every ~60s | AISStream.io (secret-gated: `AISSTREAM_API_KEY`) |

`weather`, `route`, and `ensemble` all call Open-Meteo but are intentionally
separate modules — a single-run deterministic forecast (`weather`), a
routing engine that *consumes* wind (`route`), and a probabilistic ensemble
overlay (`ensemble`) are different enough concerns that folding them
together would make each harder to reason about. Don't merge them for
"less code" — see `CLAUDE.md`'s reuse-vs-clarity balance.

`providers.yaml` is the single source of truth for what the Charts/Bathymetry
panels can harvest — `access: free | free-ish | secret` and `harvestable`
gate what shows up and what needs a key; see comments at the top of the
file before adding a provider. Mapbox/Google/Bing/Apple are allowed
(`access: secret`) — this is a personal, non-commercial, currently-private
project that has knowingly accepted the ToS exposure those four carry for
tile caching; read the reasoning in `providers.yaml`'s header before
touching that policy.

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

`layers.ts` is the Layers-picker's data model — a `CATALOG: LayerDef[]`
array (`{ id, label, ready, mutex?, defaultOn? }`), plus:

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
