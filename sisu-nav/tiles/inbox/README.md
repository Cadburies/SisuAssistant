# Chart import inbox

Drop `.mbtiles` / `.pmtiles` (or an OSM XYZ `{z}/{x}/{y}.png` folder) here, then pick **which files** in the Sisu Nav **Imported** panel.

- **Mac (test):** only put a small subset. A full circumnavigation dump will fill the disk.
- **F8:** bind-mount the USB/NAS folder over `/data/import` in `homeassistant/docker-compose.yml` and import everything.

Sisu Nav copies selected files into `tiles/manual/<slug>/`. It does **not** decode Navionics / C-MAP / Garmin app caches.

See `sisu-nav/INSTALLATION.md` and issue **#108**.
