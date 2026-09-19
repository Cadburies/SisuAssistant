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
# Live on F8: ./scripts/f8-deploy.sh then compose up on 192.168.0.21
# http://192.168.0.21:8088
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
| `harvest` | #80 dated tile harvest (EOX / GIBS / Esri; Google/Bing/Apple/Mapbox allowed — personal-use ToS risk accepted, see `api/providers.yaml`). Keys entered in Charts/Bathymetry write `secrets.yaml` (#102) |
| `settings` | #123 API key panel — gitignored `api/data/keys.local.json`, overrides compose/`secrets.yaml` |
| `instruments` / `layout` | #109 customizable right-hand bar + metric grid |
| `ensemble` | #91/#92/#93 ECMWF IFS + AIFS + GEFS spaghetti (one at a time) |
| `wx-extra` | #87 rain, clouds, RainViewer radar, CAMS dust |
| `waves` | #94 waves / swell Hs overlay (Open-Meteo Marine, ECMWF WAM) |
| `currents` | #95 surface currents (Open-Meteo Marine, Meteo-France SMOC) |
| `ais-global` | #115 internet AIS (AISStream.io) — Tier 4, complements local `ais` (never merged with it) |
| `hazards` | #118 anchoring hazards — submarine cables (TeleGeography, live-fetched), extensible for other obstruction types |
| `openseamap` | #125 OpenSeaMap seamarks overlay (buoys/lights/day-marks) — Layers toggle, not a basemap |
| `basemaps` | #116/#126 live rasters, chosen from the Charts dropdown (#127) — Esri/OSM keyless; Mapbox/Google/Azure Maps gate on server keys |
| `bathy` | #97 floor + #98 BlueTopo + #99 GEBCO + #100 Seascape + #103–#106 EMODnet/GMRT/Esri Ocean/MapTiler Ocean (`kind: bathymetry`) |
| `imported` | #108 USB/Finder drop-in charts — pick folder + which files; Mac subset / F8 full dump |
| `pois` | #119 provisions POI (Overpass, viewport) |
| `aircraft` | #120 ADS-B (adsb.lol, viewport) |
| `satellites` | #121 CelesTrak TLE ground tracks in view |

Advisory only; no autopilot. PredictWind + DataHub stay the offshore/human
backup.
