# Sisu Nav

Chart + AIS + windex + weather + routing cockpit for yacht **Sisu**. Not
Home Assistant, not a Signal K plugin.

Live data is the browser → Signal K WebSocket (`environment.wind.*` /
`navigation.*` / AIS vessels). The API hosts the SPA, lists tiles, and
backs a handful of `/api/*` features that need a server.

**Docs:**

- **[INSTALLATION.md](INSTALLATION.md)** — build, deploy, env vars/secrets, tiles, verify
- **[USER_GUIDE.md](USER_GUIDE.md)** — using the cockpit UI (layers, panels)
- **[DEVELOPER.md](DEVELOPER.md)** — API routing + plugin architecture, how to add a plugin
- **[DESIGN.md](DESIGN.md)** — color tokens, the glow treatment, day/night theme

Quick start (see `INSTALLATION.md` for the rest):

```bash
cd homeassistant && docker compose -f docker-compose.mac.yml up -d --build sisu-nav-api tileserver-gl
```

**Plugins:** `web/src/plugins/<id>/index.ts` is glob-loaded — see
`DEVELOPER.md` §1 for the add-a-plugin recipe. Never edit
`web/src/app/App.tsx` for feature work (exception: **#109** sidebar
layout).

| Plugin | Issue |
|--------|-------|
| `map` / `windex` | #76 (floor) |
| `weather` | #77 multi-model overlay (Open-Meteo `cell_selection=sea`) |
| `route` | #78 isochrone routing (ETA / model agreement / ensemble agreement) |
| `layers` | #85 map overlay picker (map chrome; not a stack panel) |
| `roses` | #86 wind roses from Influx `Sisu_1m` (Grafana TWD+AWS spec) |
| `notes` | #79 |
| `harvest` | #80 dated tile harvest (EOX / GIBS / Esri; Google/Bing/Apple/Mapbox allowed — personal-use ToS risk accepted, see `api/providers.yaml`) |
| `instruments` / `layout` | #109 customizable right-hand bar + metric grid |
| `ensemble` | #91 ECMWF IFS ENS spaghetti (`ens-ecmwf`; AIFS/GEFS stubs) |
| `waves` | #94 waves / swell Hs overlay (Open-Meteo Marine, ECMWF WAM) |
| `ais-global` | #115 internet AIS (AISStream.io) — Tier 4, complements local `ais` (never merged with it) |
| `hazards` | #118 anchoring hazards — submarine cables (TeleGeography, live-fetched), extensible for other obstruction types |
| `basemaps` | #116 live (un-cached) basemap toggles — Esri/OSM keyless, Mapbox needs `MAPBOX_ACCESS_TOKEN`; Google/Bing stubbed |
| `bathy` | #97 bathymetry harvest floor (`kind: bathymetry`; no live provider yet — #98/#99/#100) |

Advisory only; no autopilot. PredictWind + DataHub stay the offshore/human
backup.
