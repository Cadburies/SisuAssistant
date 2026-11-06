# Chart import inbox

Drop `.mbtiles` / `.pmtiles` (or an OSM XYZ `{z}/{x}/{y}.png` folder) here, or a Navionics folder (`T08`, `T32`, `MBM`, `lsc`), then pick **which files** in the Sisu Nav **Imported** panel. A Navionics folder is one row. Import converts it with `api/harvest/navionics.mjs`.

- **Mac (test):** only put a small subset. A full circumnavigation dump will fill the disk.
- **F8:** bind-mount the USB/NAS folder over `/data/import` in `homeassistant/docker-compose.yml` and import everything.

Sisu Nav copies selected archives into `tiles/manual/<slug>/`. A Navionics folder becomes `navionics-sonarchart-<yyyy-mm>` (`T08` `.nv2`), `navionics-s57-<yyyy-mm>` (`T32` `.s57`), `navionics-nautical-<yyyy-mm>` (`MBM` `.nv2`), and `navionics-live-sonar-<yyyy-mm>` (`lsc` `.lsd`). Live Sonar is zoom-15 PNGs. The other three are recorded and the chart is not drawn yet.

See `sisu-nav/INSTALLATION.md` and issue **#108**.
