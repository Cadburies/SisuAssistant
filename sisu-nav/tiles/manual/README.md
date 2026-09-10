# Manual / imported chart tiles

Imported archives live in `manual/<slug>/`:

- `meta.json` (required for the set to show in the Imported panel)
- `<slug>.mbtiles` and/or `.pmtiles`

Use the **Imported** panel to pick a folder inside the inbox and which files to copy. You can also drop a finished `meta.json` + archive here by hand.

tileserver-gl is in directory mode and reloads when files appear — no compose restart.

Dated harvest trees (`../satellite/`, `../bathymetry/`) are **#80** / **#98–#106**, not this folder.

**Hard no:** Sisu Nav will not decode Navionics / C-MAP / Garmin / UKHO app caches.
