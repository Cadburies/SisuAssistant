# Harvest plugin — issues #80 / #82

Dated tile harvest UI (EOX / GIBS / Esri; MapTiler / Maxar / Planet stay secret-gated). Glob-loaded (`slot: panel`). Do not edit `App.tsx`.

**#82:** auto-harvest the **current map view** at the current zoom for the **selected provider** (debounce after pan/zoom). Pause with “Auto this view”. Guards: skip below z8, Esri export limit, disk quota, secret-missing, NOAA ENC stub. Tiny pans that stay inside an existing job’s bbox do not start another scrape.

Jobs write into `sisu-nav/tiles/<kind>/<provider>/<region>/<date>/` — never overwritten. `tileserver-gl` picks up new `.mbtiles`.
