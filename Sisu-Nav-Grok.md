# Sisu Nav — Grok plan (ideas bounce, 2026-09-07)

> Repo copy: `Sisu-Nav-Grok.md`. Updated after Claude’s remaining-diff list (compose timing, onboarding self-heal).

Not a rebuild of Navily / NFL / Windy / PredictWind / KIP. Those apps overlap, but each unique bit is why you run five of them. This app is a **new shell** that combines those *capabilities* in one look, then adds what none of them do: **multi-model agreement on the chart, and routes that prefer where models agree.**

Still bouncing. One GitHub issue later, from **one** merged plan. Do not file two.

**Decision:** dedicated Docker app `sisu-nav`. SK is the live-data bus (AIS, position, resources, wind). Kernel MQTT (`sisu/v1`) is the source of truth; the browser reads it **via SK WS** (`environment.wind.*` already bridged). The app owns map, overlays, tile store, routing, and **custom instruments** — KIP is not the gauge UI.

---

## Claude remaining diffs — Grok stance

| # | Topic | Stance |
|---|--------|--------|
| 1 | F8 compose timing | **Adopt Claude.** Phase 1 edits **both** `docker-compose.yml` and `docker-compose.mac.yml` (same pattern as Influx/Grafana). Verify `docker compose -f homeassistant/docker-compose.yml config` even if F8 is not racked. Live smoke on Mac until #6. Do not leave a “port to F8 compose” follow-up. |
| 2 | Onboarding docs | **Keep / restore.** When Phase 1 lands a URL, the **same change** updates README, `Technical Specifications.md`, and `INSTALLATION.md` (CLAUDE.md self-heal). `docs/SISU_NAV.md` + INDEX Read-Next once it actually runs — not vaporware. |
| 3 | Prose density | **Keep Grok terse.** Reasoning that must survive: agreement ≠ ensemble; Google/Bing not harvested; polar ≫ model; EOX default / GIBS for “this week’s cloud.” |
| 4 | Product thesis | **Keep** the one-liner above. |
| 5 | Why not a SK plugin | **Add** a short section (below). Settled, but the trail should live in the plan. |

Round-3 technical agreement (unchanged): browser → SK WS for live data; API is not a live proxy; API uses SK REST later for route **writes** and planning lookups; one Open-Meteo `models=` call + `cell_selection=sea`; barbs + agreement heatmap; particles = **one** model; three router modes; dated `sisu-nav/tiles/`; no Google/Bing in the dropdown; windex Phase 1 required.

---

## Why not a Signal K plugin / Freeboard

Freeboard-SK has no plugin surface. SK plugins share the Node process with AIS. This app is WebGL + its own build + weather grids + harvest jobs + isochrone compute. SK is an **upstream** (live WS + resources REST), not the host.

---

## Model-agreement (the new piece)

Two uncertainty signals — keep the names distinct:

1. **True ensemble** — GEFS / ECMWF ENS members: spaghetti, P90, ETA spread. Phase 3.
2. **Model-agreement** — multi-select deterministic models (GFS, ECMWF IFS, ICON, GEM, AIFS). One Open-Meteo forecast call with `models=` and `cell_selection=sea`.

**Viz (Phase 2):** heatmap of vector spread (green agree / red diverge); cruise zoom: one colored barb per selected model; far zoom: heatmap + a **single agreement glyph** (or agreed-mean barb) so the map is not a hedgehog; click cell → per-model TWD/TWS table. Particles = one selected model or off — not N overlapping fields.

**Routing (Phase 3) — three modes, not one slider:** minimize ETA; prefer ensemble-member agreement; prefer multi-model agreement. Combinable later. Clustered ~10 members default; **deep** = full set on demand. Comfort caps (max TWS / wave) in the route UI.

---

## Tile store

Env `SISU_TILES_DIR`, default `/data/tiles` → bind `sisu-nav/tiles/` (gitignored). Mounted into tileserver-gl and sisu-nav-api. Directory-mode auto-discovery of `.mbtiles`/`.pmtiles`. Harvest never overwrites; new dated folder + `meta.json`. Disk quota + resumable jobs. Every snapshot stays selectable (no `current` symlink).

```
sisu-nav/tiles/
  nautical/openseamap/…
  nautical/noaa-enc/<region>/YYYY-MM-DD/{*.mbtiles, meta.json}
  satellite/eox-s2-cloudless/<region>/YYYY-MM-DD/
  satellite/nasa-gibs/<region>/YYYY-MM-DD/
  satellite/esri/<region>/YYYY-MM-DD/
  manual/README.md
```

### Harvest (Phase 2 stretch or issue 2b — not Phase 1)

| Provider | Dropdown | Notes |
|----------|----------|--------|
| OpenSeaMap | free | Nautical marks; MVP online too. |
| EOX Sentinel-2 cloudless | free | Annual composite; **default satellite**. Do not re-harvest weekly. |
| NASA GIBS | free | Near-daily; harvest when this week’s cloud/sunglare matters. |
| NOAA ENC → MBTiles | free | USVI ok; **BVI coverage check**. |
| Esri World Imagery export | free-ish | Show tile-count/ToS limits in UI. |
| MapTiler Satellite offline | * | Official MBTiles SKU; `!secret`. |
| Maxar / Planet | * | Official export only. |
| Mapbox | omit until an official offline SKU exists | Do not XYZ-scrape. |
| Google / Bing / Apple | **not listed** | ToS. `manual/` drop-in only. |

---

## Windex (not KIP)

Designed SVG/canvas glass: TWD/TWS + AWA/AWS, side or fullscreen. Phase 1 **required**.

**Path (settled):** `sisu/v1` → `signalk-mqtt-sensors` → SK `environment.wind.*` / `navigation.*` → **browser SK WS** (same socket as AIS). No MQTT in the app. No Mosquitto-WS fallback.

---

## Architecture

```
SK WS (position, AIS, environment.wind.*, navigation.*) ──► sisu-nav-web
Open-Meteo (models=, cell_selection=sea) ─► sisu-nav-api ─┤  grids, heatmap, harvest, isochrone
API → SK REST (Phase 3): route writes, planning position     │
sisu-nav/tiles/ ──► tileserver-gl ──────────────────────────┘
```

```
sisu-nav/
  web/
  api/            + providers.yaml
  polar/
  tiles/          gitignored volume
```

**Compose:** Phase 1 adds `sisu-nav-api` + `tileserver-gl` + tiles volume to **both** `homeassistant/docker-compose.yml` and `docker-compose.mac.yml`. Verify both `docker compose … config`. Live against Mac until #6.

Land-avoidance: Phase 3 spike — HTTP to `signalk-weather-routing` only if already installed; do not make GDAL/plugin a Phase 1 dependency. Default is reuse GSHHG ideas inside sisu-nav, not GDAL-in-the-API.

---

## Overlay stack

1. Basemap — OSM/OpenSeaMap + local dated satellite/nautical  
2. Live boat + AIS + **windex**  
3. One-model particles (optional; off by default on small screens)  
4. Multi-model **barbs + agreement heatmap** (+ far-zoom glyph)  
5. True ensemble spaghetti  
6. Waves / current  
7. Routes — three modes + comfort caps  
8. SK `notes`; optional `@noforeignland/signalk-to-noforeignland`

Phase 1 = 1–2. Phase 2 = 3–4 (+ harvest stretch). Phase 3 = 5–7. Phase 4 = 8.

---

## Phases

### Phase 1 — Floor

- Scaffold `sisu-nav/{web,api,tiles}` + Dockerfiles.
- **Both** compose files + tiles volume.
- MapLibre: public OpenSeaMap/OSM; drop-in scan of `tiles/manual/`.
- SK WS: position, track, AIS, wind.
- Custom windex (side + fullscreen).
- Onboarding trio (README, Technical Specifications, INSTALLATION) in the **same change** once a LAN URL exists.
- **Verify:** AIS/position match Freeboard; windex matches SK / `sensor.nmea_*`; drop `.mbtiles` into `tiles/manual/` and it appears without a restart; **both** compose configs; `./scripts/scan_secrets.sh`.

### Phase 2 — Weather + agreement viz

- Open-Meteo one-call `models=`, `cell_selection=sea`.
- Heatmap + colored barbs; particles for a single model only.
- Harvest stretch: EOX + GIBS first.
- **Verify:** GFS vs ECMWF flags on a BVI tile; heatmap red on a split, green on a quiet day.

### Phase 3 — Routing

- Three named modes; clustered GEFS + deep; comfort caps; polar warning.
- Commit route → SK `resources/routes` via API REST.
- **Verify:** BVI hop; one member vs Windy/LuckGrib.

### Phase 4 — Notes

- SK `notes`. Link NFL/Navily. Optional NFL track-push plugin.

---

## Risks

- Four phases; only Phase 1 first.
- OpenSeaMap ≠ ENC; BVI ENC coverage unknown.
- Polar ≫ model.
- Tablet GPU: particles off by default; barbs viewport-only.
- Open-Meteo bbox/rate → cluster, then GRIB v2.
- Harvest disk + ToS; Esri limits in UI.
- Advisory only; PredictWind + DataHub stay the offshore backup; no autopilot.

---

## First move (issues filed)

- **#76** Phase 1 floor (claimable)
- **#77** Phase 2 overlay — Depends on #76
- **#78** Phase 3 routing — Depends on #77
- **#79** Phase 4 notes — Depends on #76; not parallel with #77/#78 (`sisu-nav/web/**`)

Label: `sisu-nav`. Do not start #77–#79 until #76 is closed.
