# Sisu Nav

Chart + AIS + windex cockpit for yacht **Sisu**. Not Home Assistant, not a Signal K plugin.

Live data is the browser → Signal K WebSocket (`environment.wind.*` / `navigation.*` / AIS vessels). The API only hosts the SPA and lists drop-in tiles.

| Service | Mac (interim, #6) | F8 target |
|---------|-------------------|-----------|
| App | `http://<mac-lan-ip>:8088` | `http://192.168.0.21:8088` |
| tileserver-gl | `:8087` | `:8087` |
| Signal K (upstream) | `:3000` | `:3000` |

Compose: `homeassistant/docker-compose.mac.yml` (live until F8) and `homeassistant/docker-compose.yml` (F8 shape). Bring-up is the existing Mac stack command; these two services join it.

```bash
cd homeassistant && docker compose -f docker-compose.mac.yml up -d --build sisu-nav-api tileserver-gl
```

**Tiles:** drop `.mbtiles` / `.pmtiles` into `tiles/manual/`. tileserver-gl is directory-mode (no operator config); new files are picked up without a compose restart. Dated provider harvests (EOX / GIBS / Esri / secret-gated MapTiler·Maxar·Planet) run inside `sisu-nav-api` itself — issue **#80**, registry at `api/providers.yaml`, output under `tiles/{nautical,satellite}/<provider>/<region>/<date>/`. `sisu-nav-api`'s `tiles` volume mount is read-write for this reason (not read-only).

**Plugins:** `web/src/plugins/<id>/index.ts` is glob-loaded. Later issues must not edit `web/src/app/App.tsx`.

| Plugin | Issue |
|--------|-------|
| `map` / `windex` | #76 (floor) |
| `weather` | #77 multi-model overlay (Open-Meteo `cell_selection=sea`) |
| `route` | #78 isochrone routing (ETA / model agreement / ensemble agreement) |
| `notes` | #79 |
| `harvest` | #80 dated tile harvest (EOX / GIBS / Esri; no Google/Bing/Apple/Mapbox) |

Advisory only; no autopilot. PredictWind + DataHub stay the offshore/human backup.

Signal K on this vessel requires login (`allow_readonly: false`). The app authenticates against SK and puts the JWT on the WebSocket URL — it does not proxy the live feed.
