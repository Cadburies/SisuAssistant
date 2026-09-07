# Harvest plugin — issues #80 / #82

Dated tile harvest UI (EOX / GIBS / Esri; MapTiler / Maxar / Planet stay secret-gated). Glob-loaded (`slot: panel`). Do not edit `App.tsx`.

**#82:** auto-harvest the **current map view** at the current zoom for the **selected provider** (debounce after pan/zoom). Pause with “Auto this view”. Guards: skip below z8, Esri export limit, disk quota, secret-missing, NOAA ENC stub.

**#83:** skip when the provider **sourceDate** is unchanged (EOX layer year, GIBS product day, Esri Last-Modified/30d). Same source date **fills missing tiles** in the existing MBTiles instead of creating `_2`. UI shows skipped / filled N / harvest.
