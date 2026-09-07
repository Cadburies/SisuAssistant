# Sisu Nav — a self-hosted marine navigation + weather cockpit

> Claude architecture plan, updated 2026-09-07 after reconciling with `Sisu-Nav-Grok.md`.
> Core decision is unchanged; several details below are adopted from Grok's plan (marked
> **[Grok]**) where independently verified or clearly stronger, plus two things I'd flag
> before either plan is filed as an issue — see **Reconciliation notes** at the end.
>
> **Round 2 (same session):** four feature additions folded in — a multi-model **agreement**
> layer (not just a model picker), versioned/dated local tile storage with a drop-in folder,
> an in-app tile-download tool with a provider dropdown, and a bespoke wind-instrument panel
> fed from MQTT instead of embedding KIP. See the four new sections below and the updated
> overlay stack / Phase 1–3 content. Still ideation, not filed anywhere yet.
>
> **Round 3:** Grok reviewed round 2 and pushed back on four things, all adopted here after
> checking them against the repo rather than taking them on faith: (1) drop the API-side
> MQTT proxy for the wind panel — **verified** `signalk-mqtt-sensors.json` already bridges
> every `sisu/v1/wind/*` and `sisu/v1/nav/*` MQTT topic straight into SK as
> `environment.wind.*`/`navigation.*`, so the browser can get wind the same way it gets
> AIS/position: talk to SK's WS directly, no proxy, no Mosquitto question to even check;
> (2) drop the "thin SK proxy" in `sisu-nav-api` for the same reason — position/AIS/wind go
> browser→SK directly, the API's SK involvement narrows to what it actually needs
   server-side (resource writes, routing input); (3) N simultaneous colored particle fields
> is unreadable — particles show **one** model at a time (or off), multi-model *comparison*
> is barbs + the agreement heatmap, not stacked animations; (4) the wind panel ("**windex**",
> adopting Grok's name for it) is a Phase 1 floor item, not a stretch — it's one of the four
> things directly asked for, no reason to defer it.
>
> **Round 4:** Grok cross-checked this document against its own round-3 header and caught
> two places where a later section still contradicted it — genuinely useful, since one had
> already slipped past my own review. Fixed: the Phase 2 web bullet still described one
> particle layer per model (item 2, confirmed stale, corrected); the "First move" section
> still said "MQTT wind panel stretch" (item 10 — this one I'd actually already fixed one
> turn earlier, so it was Grok reviewing a slightly older copy, not a second miss). Also
> adopted: an overview-zoom agreement glyph so far-out views don't turn into a barb hedgehog
> (item 3); explicit confirmation harvest needs no new compose service (item 4); land-
> avoidance downgraded from "call the plugin" to a Phase 3 spike, not a Phase 1/2 dependency,
> with the plugin's own GDAL-optional-dependency ambiguity and "not validated by actual
> sailing" disclaimer both flagged rather than smoothed over (item 5); tightened the
> "merges Navily/NFL/Windy/..." framing so it can't be read as promising their datasets,
> which Phase 4 already explicitly declines to build (item 9). Not changed: the paid-harvest
> provider list already omitted Mapbox pending a confirmed official offline-export product —
> Grok's own recommendation on that point (item 7) matched what was already here, so nothing
> to fix, just confirming rather than conceding.

## Context

Original ask was a weather-routing tool with ensemble models. Scope has since expanded to
a single dedicated app — a new shell combining the *capabilities* that Navily/No Foreign
Land, Windy/PredictWind, and Freeboard-SK/KIP each provide separately, not a rebuild of
their datasets (Navily's reviews, NFL's wiki, PredictWind's proprietary models). **Framing
tightened per Grok's round-3 critique**: the earlier "merges what X/Y/Z each do" wording
read as literal feature-parity cloning, which Phase 4 explicitly rejects (private notes +
link-out, not a crowd-sourced dataset) — worth being precise about that distinction now
rather than let the ambition statement contradict the actual scope decision later. What
this app adds that none of those five do on their own: multi-model agreement on the chart,
and routes that prefer where models agree. That's a real, buildable product — this is
genuinely how commercial tools in this space are built (tiled vector/raster maps +
server-rendered weather grids + a data API) — but it's a multi-phase app, not a plugin
install.

Decisions locked in:
- **Signal K stays underneath** as the sensor/AIS/position/instrument/resources hub. The
  new app doesn't re-parse NMEA — it consumes SK's existing WebSocket + REST API, the same
  way Freeboard-SK and KIP already do. Nothing about the boat's data pipeline changes.
- **All four surfaces are in scope long-term** (chart+AIS floor, live weather overlay,
  ensemble routing overlay, anchorage social layer) — sequenced below, not built at once.

Relevant facts from investigating the existing stack (still true, still useful even though
the shape of the solution changed):
- SK already has live boat position/AIS/instruments and an empty-but-wired
  `resources-provider` (routes/waypoints/**notes**/regions/charts/tracks) — the `notes`
  resource type is a real, already-provisioned seed for a personal/crew anchorage-notes
  layer (Phase 4), not a social product, but a genuine starting point instead of nothing.
- `signalk-weather-routing` (deterministic isochrone + land avoidance + polar CSV parsing,
  Apache-2.0, already cached in `homeassistant/signalk/appstore-cache/`) is worth reusing
  as an **algorithm reference / optional backend**, not the primary UI — its output (a route
  resource) can still be pulled into the new app's map instead of rebuilding land-avoidance
  isochrone logic from zero.
- Open-Meteo's free, keyless **Ensemble API** (GEFS/ICON-EPS/ECMWF-ENS/GEM, up to 51
  members, JSON) is the ensemble data source — no GRIB parsing needed for v1. **[Grok, verified]**
  always call it (and the regular forecast API) with `cell_selection=sea` — confirmed
  against Open-Meteo's live docs: the default (`land`) snaps coastal/anchorage coordinates
  to the nearest *land* grid cell for elevation-matching purposes, which is exactly wrong
  for a boat. GRIB (GFS/GEFS via NOMADS) stays a **v2/offline fallback**, not a v1
  requirement — reach for it only if Open-Meteo rate-limits, its bbox resolution is too
  coarse for a specific area, or native per-member GEFS files are needed underway with no
  API access.
- F8's compose stack uses `TZ: America/Tortola` throughout — Sisu's cruising grounds are
  the BVI/Caribbean, which matters for chart-tile scope (see Phase 1). **F8 itself isn't
  racked yet** (issue #6 open) — develop and verify against `docker-compose.mac.yml`, wire
  `docker-compose.yml` in parallel, don't block on the physical box.

---

## Architecture

**Revised (round 3):** Signal K's WS is the single live-data socket the browser opens — for
AIS, position, *and* wind/instruments (all confirmed already native SK paths, see round-3
note above). Nothing about that path touches `sisu-nav-api` or Mosquitto. The API's job
narrows to what actually needs a server: Open-Meteo processing, tile-download jobs, and
routing compute (which still needs its own SK REST calls — to read a start position for a
non-"current position" plan, and to write the committed route back to `resources/routes` —
just not as a blanket proxy of the browser's live feed).

```
Signal K WS (position, AIS, environment.wind.*, navigation.*) ─────────► sisu-nav-web
                                                                                │
Open-Meteo (models=, cell_selection=sea, ensemble) ──► sisu-nav-api ──────────┤
  (forecast grids · agreement scorer · isochrone router · tile-download jobs)  │
  SK REST (route writes, position lookups for planning) ◄──────────────────────┘
                                                                                │
sisu-nav/tiles/ (dated MBTiles, drop-in) ──► tileserver-gl (directory-mode) ───┘
```

Reuse vs. new, so effort is spent only where nothing already solves it:

| Layer | Approach |
|---|---|
| Base charts | **Reuse**: `tileserver-gl` (existing OSS Docker image, confirmed it auto-discovers `.mbtiles`/`.pmtiles` in a directory with **no config file needed**) serving nautical tiles. MVP: proxy free public OpenSeaMap-over-OSM tiles. Later: self-host regional MBTiles for the BVI/Caribbean via the tile-storage scheme below. |
| Own vessel + AIS + wind/instruments | **Reuse**: Signal K's existing WS delta stream, consumed **directly by the frontend** (no API proxy — see round-3 revision above) — same socket Freeboard-SK already uses, wind included since `environment.wind.*` is already bridged in from MQTT. |
| Routes/waypoints storage | **Reuse**: SK's `resources-provider`, already enabled and empty. |
| Live weather overlay | **New, standard technique + new "agreement" idea, revised (round 3)**: WebGL **particles for one selected model at a time** (or off) — encode that model's U/V grid into a texture, animate particles sampling it, the technique behind `mapbox/webgl-wind`/Windy. **Multi-model comparison is a separate rendering mode**: static colored barbs (one per selected model, readable simultaneously) + the agreement heatmap underneath — not stacked particle animations, which Grok correctly flagged as unreadable. See dedicated section below. |
| Ensemble routing | **New**: isochrone pass per ensemble member (Open-Meteo Ensemble API) + aggregation into a probability corridor + ETA spread, as one of three separate routing modes alongside model-agreement routing (see below). Can borrow `signalk-weather-routing`'s land-avoidance/polar-parsing logic as a reference or literally shell out to it for the deterministic/coastal case. |
| Instruments ("windex") | **Reworked this round**: not KIP. A bespoke **Phase 1 floor item** (promoted from stretch, round 3), fed straight from SK's WS like everything else above — no MQTT involvement needed at all. See dedicated section below. |
| Tile storage | **New**: a configurable, dated, drop-in-friendly local folder — see dedicated section below. |
| Anchorage/marina social layer | **New, deliberately minimal at first**: seed from SK's `notes` resource type as a private/crew layer; no open dataset exists to bootstrap a public one — do not attempt to rebuild No Foreign Land's crowd data. **[Grok, verified]** `@noforeignland/signalk-to-noforeignland` is a real, npm-published SK plugin that pushes the boat's track to NoForeignLand given an API key — legitimate optional add-on for Phase 4, separate from (and much smaller than) attempting to clone their review/wiki data. |

**Layout** — repo-root `sisu-nav/` (sibling of `homeassistant/`, `MarineBoard/`), not buried
in HA config:

```
sisu-nav/
  web/         Vite + MapLibre SPA (+ windex component)
  api/         FastAPI (or equivalent) + Docker + providers.yaml (harvest registry)
  polar/       ORC/OpenCPN CSV
  tiles/       gitignored data volume (see Tile storage section) — [Grok, round 3] fix:
               this was missing from the tree in earlier drafts despite being described
               in prose; it's first-class, not an afterthought.
  README       pointer only until Phase 1 runs
```

v1 can be **two** containers (api serving the static SPA, + tileserver-gl). Split the web
build into its own container later only if the frontend pipeline needs it independently.

---

## Multi-model agreement layer (new)

Distinct from the true **ensemble** (many runs of *one* model family, e.g. GEFS's 51
members) — this is a **multi-model** comparison: several different *deterministic* models
(GFS, ECMWF IFS, ICON, GEM, AIFS) overlaid on the same tile, each drawn in its own fixed
color, so agreement/disagreement is visible at a glance. Both are legitimate, complementary
uncertainty signals and the router can eventually use either or both.

- **One API call, not N**: Open-Meteo's forecast endpoint accepts a `models=` parameter
  with a comma list (e.g. `models=gfs_seamless,ecmwf_ifs025,icon_seamless,gem_seamless`) and
  returns each variable once per requested model in a single response — confirm the exact
  per-model field-naming convention against current docs at implementation time, but the
  multi-model-in-one-call capability itself is real, so this isn't N separate slow calls.
- **Model picker becomes multi-select**, not single-select as first drafted — but **[Grok,
  round 3]** what renders per model differs by mode: at *comparison* zoom, each checked
  model draws a static colored barb per grid cell (fixed color per model, e.g. GFS=blue,
  ECMWF=red, ICON=green, GEM=purple, AIFS=orange — small legend on-screen); animated WebGL
  particles are reserved for **one** model at a time (or off) — four overlapping particle
  fields read as noise, not information, so they're not how multi-model comparison happens.
- **Agreement score per cell**: a background heatmap computed from the vector spread across
  the *currently selected* models (e.g. circular variance of direction + spread of speed) —
  green where models agree, red where they diverge. This is the layer that answers "is this
  patch of weather stable or not" at a glance, independent of picking any single ensemble.
- **Routing tie-in (Phase 3)**: the isochrone router can penalize low-agreement cells/times
  the same way it penalizes high ensemble-member spread — a "sail where the models agree"
  mode, separate from (and combinable with) the "sail where ensemble members agree" mode.
  Ship them as two clearly-labeled router options before ever trying to merge them into one
  composite score — merging noise sources badly is worse than two honest separate ones.

## Tile storage & provenance (new)

A configurable, versioned, drop-in-friendly local store — not just whatever tileserver-gl
happens to have loaded.

- **Location — [Grok, round 3] cleaner split**: env var `SISU_TILES_DIR` is the
  **in-container** path (default `/data/tiles`), bound in compose to host path
  `sisu-nav/tiles/`. Mounted into both `tileserver-gl` and `sisu-nav-api` (the API reads it
  to build the snapshot picker UI; tileserver-gl needs it to serve). `sisu-nav/tiles/` is
  gitignored — it's a data volume, not source.
- **Layout — [Grok, round 3] `nautical/` instead of `charts/`** (avoids "charts" meaning
  both "the whole tile system" and "one subfolder in it") — category / provider / region /
  dated snapshot, each snapshot immutable and self-describing:
  ```
  sisu-nav/tiles/
    nautical/openseamap/…
    nautical/noaa-enc/bvi/2026-09-07/bvi.mbtiles
    nautical/noaa-enc/bvi/2026-09-07/meta.json
    nautical/noaa-enc/bvi/2026-03-01/bvi.mbtiles       # older snapshot, kept
    nautical/noaa-enc/bvi/2026-03-01/meta.json
    satellite/eox-s2-cloudless/bvi/2026-08-01/…
    satellite/nasa-gibs/bvi/2026-09-06/…
    manual/README.md                                    # drop-in zone, see below
  ```
- **`meta.json` per snapshot**: `provider`, `region`/bbox, `acquired_at`, `format`, and a
  free-text `notes` field — this is where "less cloud cover than the September one" or
  "sun glare bad on this pass" lives, filled in by whoever downloaded/received it. For
  near-real-time providers (NASA GIBS daily imagery) that note matters every time; for a
  static annual composite (Sentinel-2 cloudless) it barely changes snapshot to snapshot —
  worth knowing which is which before re-downloading on a schedule that gains nothing.
- **No hot-reload complexity needed**: don't build an "active snapshot" symlink/reload
  mechanism. Every dated snapshot is just always a separate, permanently-selectable layer in
  the map's layer switcher (named by date), backed by tileserver-gl's own directory
  auto-discovery. The frontend's job is a layer-picker/timeline dropdown per region, reading
  the `meta.json` notes for context — simpler than making tileserver-gl reload on write.
- **Drop-in workflow** (a friend hands you tiles on a USB stick): `manual/` has a short
  README naming the convention above; anything copied in that roughly follows it gets picked
  up by tileserver-gl's directory scan regardless, and shows up (unlabeled, generic date) in
  the picker even before you bother writing a `meta.json` for it.

## Tile acquisition — in-app download menu (new)

A menu item that fetches new tiles into the scheme above, rather than always requiring a
manual drop-in.

- **Provider registry**: a small config file (`sisu-nav/api/providers.yaml`) listing name,
  category (basemap/satellite/nautical), access (`free` / `subscription`), URL
  template/endpoint, license note, and whether an API key is required. The dropdown reads
  this list; **subscription/key-required providers get an asterisk** and a note to add the
  key in settings (stored server-side only, same secrets convention as the rest of this
  repo — never in frontend JS).
- **Starting provider list** (free tier, no asterisk):
  - **OpenSeaMap** — nautical marks/seamarks, already the MVP basemap.
  - **Sentinel-2 cloudless (EOX)** — CC BY 4.0, free WMTS/WMS, global, cloud-filtered
    composite refreshed roughly annually — good default satellite basemap, low value in
    re-downloading often.
  - **NASA GIBS** — public domain, near-daily MODIS/VIIRS true-color imagery — the one
    worth re-downloading around a passage if recent cloud cover actually matters, unlike the
    EOX composite.
  - **Esri World Imagery** — free tier, but Esri's terms cap export size/tile count and
    require attribution; list it but surface those limits in the UI, don't silently exceed
    them.
  - **NOAA ENC → MBTiles** — official nautical charts, USVI coverage confirmed reasonable
    per the Risks section, BVI coverage needs a spot-check.
- **Paid/subscription providers (asterisked)** — only ones with an *official* export/offline
  product, e.g. MapTiler Satellite (sells an explicit offline-tiles product), Maxar/Planet
  via their licensed resellers. **Deliberately excluded from the dropdown entirely**: Google
  Maps / Bing Maps / Apple Maps satellite tiles — their terms of service prohibit bulk
  downloading or caching tiles outside their own SDKs, so they're not offered here at all,
  not even asterisked. That's a boundary worth keeping, not just a footnote.
- **Download flow**: pick provider + draw/select a bbox + zoom range on the map → background
  job fetches tiles respecting the provider's own rate limits → writes directly into a new
  dated MBTiles snapshot (MBTiles is just a documented SQLite schema — no exotic tooling
  needed to write one) + an auto-filled `meta.json` (provider/bbox/zoom/date; free-text notes
  addable after the fact). Harvest **never overwrites** an existing dated folder — a re-run
  just adds a new one.
- **[Grok, round 3] operational must-haves, not nice-to-haves**: a disk quota on
  `sisu-nav/tiles/` (this is a boat NAS, not infinite cloud storage — old snapshots need a
  ceiling or a manual-prune reminder) and resumable downloads (a large bbox/zoom job dying
  mid-fetch over a flaky underway internet connection shouldn't mean starting over). Attach
  attribution text to every satellite layer per its provider's license terms.

## Windex — the custom wind instrument panel (new, named per Grok round 3)

Not KIP — a bespoke gauge, because KIP's visual design isn't what's wanted here.

- **Data path — settled, not just designed**: originally planned as an API-side MQTT proxy
  (broker credentials server-side, re-published to the browser over WS/SSE) to avoid
  putting Mosquitto credentials in frontend JS. **Turns out unnecessary — verified directly
  against the repo**: `homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json`
  already subscribes to every `sisu/v1/wind/*` topic (`aws`/`tws`/`awa`/`twa`/`twd`) and
  `sisu/v1/nav/*` and injects them into Signal K as `environment.wind.speedApparent`,
  `speedTrue`, `angleApparent`, `angleTrueWater`, `directionTrue`, plus
  `navigation.speedOverGround/courseOverGroundTrue/headingTrue/position`. That's already a
  live SK path, same socket the map uses for AIS/position — **no MQTT touch at all**, no
  broker credentials anywhere near the frontend, no proxy to build. This settles the open
  question Grok flagged (whether Mosquitto has a websocket listener) — it's moot, because
  the data was never MQTT-only to begin with.
- **Visual design**: SVG/Canvas-based true-wind + apparent-wind dial(s), gradients/shadows,
  as a side panel or full-screen mode — this is a self-contained frontend component with no
  dependency on charts, tiles, or weather-overlay work, just an SK WS subscription already
  needed for Phase 1 anyway.
- **Sequencing — [Grok, round 3] promoted, not a stretch**: it's one of the four things
  directly asked for and it's genuinely cheap now that the data path is just "subscribe to
  the same socket Phase 1 already opens" — ships as a **required** part of Phase 1, not
  deferred.

---

## Phases

Each phase is its own GitHub issue when ready to execute (Task/Touches/Acceptance, claimed
before coding, per this repo's workflow). `docker-compose.yml` and `docker-compose.mac.yml`
are listed single-owner hotspots in `CLAUDE.md` — **[Grok]** declare all `sisu-nav-*`
services (including `tileserver-gl`) fully in Phase 1, even the ones with no real logic
behind them yet, rather than reopening the hotspot in every phase; Phases 2–4 then touch
only `sisu-nav/**` unless a genuinely new image is required.

### Phase 1 — Chart base + own vessel + AIS (the floor)

- New top-level directory `sisu-nav/` (sibling to `homeassistant/`, `MarineBoard/`):
  `sisu-nav/web/` (Vite + MapLibre GL JS frontend), `sisu-nav/api/` (backend), each with a
  `Dockerfile`.
- `sisu-nav-web` connects **directly to Signal K's WS** for position, AIS, and instruments
  (round 3 — no API proxy for this; see Architecture). `sisu-nav-api` v1 is just the static
  SPA host for now — its SK/Open-Meteo/routing responsibilities start in Phases 2–3.
- `tileserver-gl` service added to `docker-compose.yml`/`.mac.yml`, `restart: unless-stopped`
  (this is a persistent app people load like a webpage, same tier as Freeboard-SK/KIP), volume-
  mounted at `sisu-nav/tiles/` → container `/data/tiles` (directory-mode, no config file
  needed for it to auto-serve whatever's dropped in — see Tile storage section).
- MVP chart layer: public OpenSeaMap tiles as a MapLibre raster/vector source (no self-
  hosting needed yet); the tiles volume exists from day one even though it's empty.
- **Required, not stretch (round 3): the windex panel** — SVG/Canvas wind gauges reading
  `environment.wind.*` off the same SK WS subscription as AIS/position. No MQTT involved.
- **Verify:** app loads in a browser on the LAN, shows chart + Sisu's live position/track +
  any AIS targets, matching what Freeboard-SK already shows (cross-check against it); windex
  readings match `sensor.nmea_*`/SK's own `environment.wind.*` for the same instant; drop a
  test `.mbtiles` into `tiles/manual/` and confirm it appears in tileserver-gl without a
  restart.

### Phase 2 — Live weather overlay (multi-model + agreement)

- `sisu-nav-api` gains: Open-Meteo forecast client (`cell_selection=sea`, `models=` with a
  comma list), wind-grid fetch for the visible map bounds, per-model U/V → RGB texture
  encoding, and the agreement-score endpoint (vector spread across whichever models are
  currently selected) — all cached, TTL matched to forecast update cadence (same "don't
  poll faster than the data changes" convention this repo already follows for
  `weather_openmeteo.py`/`tides_noaa.py`).
- **This phase also ships the tile-download menu**, as a stretch/2b slice if it doesn't fit
  the same wave: provider registry, bbox/zoom picker, background harvest job, `meta.json`
  writer. Start with EOX + NASA GIBS; asterisked/key-required providers land behind the same
  secrets convention once the UI exists. **No new compose service needed** — `tileserver-gl`
  and the tiles volume are already declared in Phase 1; harvest is just new logic inside the
  already-existing `sisu-nav-api` container writing into an already-mounted volume, so its
  `Touches` is `sisu-nav/api/providers.yaml` + `sisu-nav/tiles/**`, not a third compose edit.
- `sisu-nav-web` gains: a **multi-select** model picker (GFS / ECMWF IFS / ICON / GEM /
  AIFS). **Correction — this line previously contradicted the round-3 rule above it and was
  stale**: rendering is barbs (one colored barb per selected model, comparison-zoom) +
  the agreement heatmap underneath, **not** one particle layer per model. Animated WebGL
  particles stay a single-model-or-off toggle (fork/adapt `mapbox/webgl-wind` or
  `windgl-js`), separate from the comparison view, exactly as the round-3 note says — this
  bullet just hadn't been fixed to match yet.
- **Overview-zoom collapse**: below some zoom threshold (Caribbean-wide view), don't render
  full barb sets — collapse to the heatmap plus a single agreed-mean wind glyph per visible
  region, so the map doesn't turn into a hedgehog of overlapping barbs. Barbs render in full
  once zoomed to a comparison-useful scale.
- Stretch in this phase: pressure and wave-height overlays from the same Open-Meteo forecast
  call, as additional togglable layers.
- **Verify:** each model's overlay visually matches that model's output on Windy for the
  same time/location; agreement heatmap sanity-checked by eye against two clearly-different
  forecasts (should read red) and two similar ones (should read green); one harvest job
  lands as a correctly-dated folder + `meta.json`.

### Phase 3 — Ensemble routing overlay

- `sisu-nav-api` gains the ensemble router: Open-Meteo Ensemble API client
  (`cell_selection=sea`), per-member isochrone pass (start clustered — ~10 representative
  members + control/mean; a "deep" mode runs the full set on request), aggregation into
  member routes + probability corridor + ETA histogram + P90 wind along-route — serving
  this app's map, and also writing the committed route to SK `resources/routes` so
  Freeboard-SK stays a valid fallback view.
- `sisu-nav-web` gains: corridor polygon rendering, member-route/spaghetti toggle,
  ETA-spread readout, a route-planning UI (destination, departure time, member count,
  comfort caps e.g. max TWS/wave height).
- **Land-avoidance — softened, not a committed dependency**: don't require installing
  `signalk-weather-routing` as a Phase 1/2 dependency just to unblock Phase 3. Default is
  reuse/adapt its GSHHG land-avoidance *ideas* (a coast-check index) inside `sisu-nav-api`
  directly, keeping `sisu-nav` a single stack. "Call the plugin over HTTP for the coastal
  bound" is a **Phase 3 spike**, only worth doing if the plugin is already installed for
  another reason — its own `package.json` lists `gdal-async`/platform-specific GDAL
  binaries as *optional* dependencies despite the project's README claiming none are
  required, which is worth resolving before depending on it; GDAL must not end up inside
  `sisu-nav-api` by accident either way. Worth being honest either path is chosen: the
  plugin is explicit that its own routes "may cross land or shallow water" and haven't been
  validated by actual sailing — reusing its ideas doesn't inherit a solved, trustworthy
  coastal bound, just less work than parsing GSHHG from zero. Coastal safety stays a real
  open risk in Phase 3 regardless of which path is taken.
- Routing modes exposed separately, not merged into one score (see Multi-model agreement
  section): "minimize ETA" (plain), "prefer ensemble-member agreement," "prefer multi-model
  agreement." Combining the two uncertainty signals into one composite weight is a plausible
  v4 idea, not a v1 one — ship the two honest signals first.
- Polar: the CSV in `sisu-nav/polar/` — **[Grok]** worth stating plainly: polar quality
  dominates route quality more than model choice does. A generic/estimated polar bounds how
  much to trust the output regardless of how good the weather data is.
- **Verify:** a BVI-scale test hop produces a sane corridor; spot-check one member's route
  against a manual look at Windy/LuckGrib/PredictWind for the same window.

### Phase 4 — Anchorage/marina social layer (stretch, sequenced last deliberately)

- Start from SK's `notes` resource type as a private/crew anchorage-notes layer (pins +
  free text, visible only to this boat's app instance) — genuinely useful on its own, and
  it's already-provisioned infrastructure, not new plumbing.
- Explicitly **not** attempting a public crowd-sourced dataset — no open data source exists
  to seed one, and replicating No Foreign Land's community is out of scope. If wider
  anchorage intel is wanted, link out to NFL/Navily (e.g. an embedded link per pin) rather
  than rebuild it.

---

## Docs & context updates (once phases start landing)

- New `docs/SISU_NAV.md` — architecture, how to run, what's reused vs. new, per-phase
  status.
- `README.md` doc index + `.ai_context/INDEX.md` Read-Next table get a pointer once Phase 1
  lands (not before — no doc for vaporware).
- `.ai_context/sources.md`: note Open-Meteo (current + ensemble) as an internet-tier (4)
  input feeding a *derived overlay/plan*, not a competing boat-instrument source — doesn't
  touch the existing NMEA priority table.
- **Gap this version was missing, Grok's plan had it**: CLAUDE.md's own "Onboarding docs"
  self-heal rule requires `README.md` / `Technical Specifications.md` / `INSTALLATION.md` to
  update in the *same change* whenever something they claim changes — a new stack component
  reachable at a new URL is exactly that. Once Phase 1 lands, that trio needs a line each
  (what sisu-nav is, where it runs, how to reach it), same wave as the compose landing, not
  a follow-up.

## Why not build this as a Signal K plugin / inside Freeboard-SK instead

Considered and rejected for this expanded scope: Freeboard-SK is a fixed, non-extensible
webapp (no plugin surface of its own) and SK plugins run inside the Node server process —
fine for a narrow routing tool, a poor fit for a WebGL-heavy, independently-iterated
frontend with its own build pipeline and multiple backend responsibilities (tile serving,
weather-grid rendering, routing compute). A dedicated app with SK as one upstream data
source is the more scalable shape for where this is going.

## Verification (once phases are implemented)

- Phase 1: `docker compose -f homeassistant/docker-compose.yml config` (new services parse),
  `./scripts/scan_secrets.sh`, live load-test in browser against SK's live WS/REST feed.
- Phase 2/3: same compose + secrets checks; visual sanity-check overlays against Windy /
  a manual forecast look; ensemble ETA spread cross-checked against a manual GRIB look for
  one test case.
- Every phase: normal repo closing cycle — GitHub issue (Touches/Acceptance), claim label,
  verify green, context self-heal (`INDEX.md`, `sources.md`, new `SISU_NAV.md`), scoped
  commit + push.

---

## Risks — **[Grok]**, worth stating up front rather than discovering mid-build

- **Scope creep**: this is four real phases. Phase 1 is the only thing to actually start
  implementing; nothing else gets built before it's proven against Freeboard-SK.
- **Chart coverage**: OpenSeaMap is not an official ENC. NOAA ENC→MBTiles helps for USVI
  waters; BVI cays specifically need a coverage check before this is trusted as an actual
  plotter rather than a situational-awareness overlay.
- **Polar quality dominates route quality** (see Phase 3) — flag this to whoever reads the
  routing output, always, not just in this doc.
- **GPU on a saloon tablet**: WebGL particles are optional/toggle-off; ensemble tiles and
  wind roses should render **viewport-only**, not globally, to stay usable on modest
  hardware underway.
- **Open-Meteo bbox size / rate limits**: if a full-member isochrone grid for a large area
  is too heavy, cluster members first and/or fall back to GRIB (already scoped as v2).
- **Not safety-critical, no autopilot integration** — this is a planning/situational-
  awareness aid. PredictWind + the existing DataHub NMEA gateway remain the offshore/human
  backup; this app doesn't replace them, same spirit as `safety.md`'s stance that nothing
  safety-critical depends on any of this stack staying up.

---

## First move after approval

File **one** Phase 1 GitHub issue (`Touches: sisu-nav/**` including `sisu-nav/tiles/**`
explicitly — it's gitignored data, easy for a parallel-safety scan to miss otherwise —
plus both compose files). Claim it, scaffold the map + SK position/AIS + windex + empty
tiles volume, prove it against Freeboard-SK. Nothing from Open-Meteo, no harvest jobs, no
router in this wave — those start in Phase 2/3.

---

## Reconciliation notes vs. `Sisu-Nav-Grok.md`

The two plans reached the same architecture independently — dedicated Docker app, SK as
upstream data hub only, four phases in the same order, same reuse targets
(`tileserver-gl`, `signalk-weather-routing`, SK `notes`). That convergence is itself a
decent signal the decision is right. Differences worth flagging before either is filed as
an issue:

1. **Round 1**: this version verified two of Grok's specific claims live rather than taking
   them on faith: `cell_selection=sea` is a real Open-Meteo parameter (checked against
   current docs), and `@noforeignland/signalk-to-noforeignland` is a real, published plugin
   (checked against npm). Both checked out — adopted.
2. **Round 3**: Grok reviewed this doc's round 2 and pushed back on four specifics (drop the
   MQTT proxy for windex, drop the "thin SK proxy" in the API, particles single-model-only
   with barbs for comparison, promote windex to Phase 1 required). All four adopted here
   after independent verification, not just deference — in particular, reading
   `signalk-mqtt-sensors.json` directly settled the windex data-path question more
   conclusively than either plan had it: wind is already a native SK path
   (`environment.wind.*`), not something that needs touching MQTT from the app at all.
3. **The two documents are now extremely close** — differences left are mostly naming
   (`nautical/` vs earlier `charts/`) and presentation, not substance. **Don't file both as
   separate issues.** Pick one document as *the* plan (or merge into a single
   `SISU_NAV_PLAN.md`) before filing the GitHub issue — two overlapping specs for the same
   `Touches: sisu-nav/**` is exactly the kind of ambiguity this repo's parallel-agent claim
   protocol exists to prevent.
