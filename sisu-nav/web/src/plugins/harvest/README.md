# Harvest plugin — issue #80

Dated tile harvest UI (EOX / GIBS / Esri; MapTiler / Maxar / Planet stay secret-gated). Glob-loaded (`slot: panel`). Do not edit `App.tsx` or the map shell — uses `../map/registry` (`subscribeNavMap`) to draw the download bbox on the live map, same extension point weather (#77) uses.

Provider dropdown, quota, and job control come from `api/harvest/**` (`/api/harvest/providers|estimate|jobs`). Provider registry is `api/providers.yaml` — Google/Bing/Apple/Mapbox are absent on purpose (no official offline SKU / ToS forbids scraping).

Jobs write into `sisu-nav/tiles/<kind>/<provider>/<region>/<date>/` — never overwritten; a completed day gets a fresh `_2` suffix on re-run. `tileserver-gl` (directory mode) and `GET /api/tilesets` pick up any new `.mbtiles` automatically.
