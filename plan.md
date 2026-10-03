# One chart picker for Sisu Nav

Shipped in #185. This is the design the Charts panel follows. The baseline below is what the three old selectors did before that change. Do not rebuild it.

## Baseline this replaced

Three sidebar panels can change charts. Plugins load from `sisu-nav/web/src/plugins/*/index.ts`.

| Panel | Plugin | What you actually pick |
| --- | --- | --- |
| **Charts** | `harvest` order 30, `HarvestPanel.tsx` | One `<select>` titled Basemap. Optgroups: 5 live sources (`LIVE_BASEMAPS` in `plugins/map/basemap.ts`), every harvestable non-bathy provider, and **every** imported nautical/satellite set (`fetchSets`). Choosing a harvest row also arms “Auto this view” for that provider. |
| **Imported** | `imported` order 29, `ImportPanel.tsx` + `ImportedSets.tsx` | A second radio per imported set, worldwide, plus the USB inbox (folder, file checkboxes, kind). |
| **Bathymetry** | `bathy` order 31, `BathyPanel.tsx` | Another provider `<select>`, “Pin source”, “Auto this view”, and a checkbox per imported `bathymetry` set. |

`plugins/basemaps/` has no panel (`slot: 'none'`). `LiveBasemapSync` paints the live raster from the shared store. OpenSeaMap is a Layers overlay, not a basemap (`providers.yaml` `openseamap.harvestable: false`).

One store, `plugins/map/basemap.ts`: `live:` / `harvest:` / `imported:`, localStorage key `sisu-nav.basemap`. Default when empty is `{kind:'live', id:'osm'}`. `MapView.tsx` `applyTilesets()` adds **every** non-bathy file of the chosen provider or slug, worldwide, with no `bounds`. It polls `/api/tilesets` every 3 s.

`/api/tilesets` (`listTilesets` in `api/server.mjs`) returns `id, file, format, kind, mtimeMs, bytes, label, imported, tileSize`. It already reads the `meta.json` **next to** each archive and then drops `bbox` / `bounds` / `minZoom` / `maxZoom` / `provider`. Harvest writes that `meta.json` in the same directory as the mbtiles (`api/harvest/jobs.mjs` `writeMeta`). The comment in `listTilesets` about “one level up” is stale.

Imported `meta.json` (`api/harvest/import.mjs`) sets `provider` to the **per-file slug**, `providerLabel` to the file’s label, and `bounds` / `minZoom` / `maxZoom` from `peekMbtiles()` when the archive has them. Forty Navionics areas do **not** share a provider id. v3’s “group by `provider`” would not collapse them.

`/api/harvest/estimate` returns a tile **count** for the view, not a percent already on disk. `countMissingTiles()` in `mbtiles.mjs` exists and is used when a job starts.

Bing Aerial is `bing-aerial`, `harvestable: false`, retired 2026-06-30. The live replacement is Azure Maps (`azure` / `azure-maps-imagery`). There is no live Navionics provider. NOAA ENC and BlueTopo carry `coverageBbox`, and that box is large enough to include the BVI even where the notes say NOAA does not chart it. Real emptiness is a tile probe (`api/harvest/coverage.mjs`), not the box.

Client `NO_AUTO` in `HarvestPanel.tsx` and `autoHarvest` in `providers.yaml` disagree. MapTiler Satellite, Maxar, and Planet are server stubs (`STUB_HARVESTERS` in `jobs.mjs`).

## Product

One sidebar panel, title **Charts**. It is the only control that sets the basemap. Weather, Layers, AIS, and the other panels stay.

The list shows what you can look at **in this view**:

- Imported charts whose bounds overlap the view (Navionics and any other manual set).
- Harvested sets whose `bbox` overlaps the view.
- Live imagery that works here: OpenStreetMap, Esri (ArcGIS) World Imagery, Google Satellite, Mapbox Satellite, Azure Maps Imagery. Azure is the Bing row. A missing key greys the row and opens the existing `SecretField`.

A chart with no tiles here and no live picture is not a row. NOAA at the BVI, a Grenada-only Navionics file, and retired Bing stay out of the list.

```
Charts                          BVI · z13
◉ Auto                          Navionics
○ Navionics                     on this boat · 6 areas · z8–16
● Esri imagery                  saved z12–18 · live fills gaps
○ Google Satellite              live
○ Mapbox Satellite              live
○ OpenStreetMap                 live
○ Azure imagery                 live · replaces Bing

[ Get charts for this view ]
[ Add from USB ]

Esri imagery
Saved for most of this view · 214 tiles still missing
[ Download the rest · ~3 MB ]
[x] Keep filling as I pan
Jobs (3) ▸

Depth ▸ Seascape · relief off
```

“Get charts for this view” is a button, not a second selector and not a “More sources (12)” block inside the list. It opens the harvestable providers you do not already have here, with the coverage reason when this view is outside that provider (“NOAA does not chart this view”). Stubs (Maxar, Planet, MapTiler Satellite) show as not downloadable yet. OpenSeaMap, Apple Maps, and retired Bing are absent unless a Bing archive is already on disk, in which case that archive is an ordinary offline row.

“Add from USB” is today’s Imported inbox (folder, checkboxes, kind, import jobs). It is a drawer on this panel. The Imported sidebar panel goes away.

### One row per chart you would name

Built in the client from live catalog + `/api/harvest/providers` + `/api/tilesets`.

- **Live + harvest twins are one row:** `esri`↔`esri-world-imagery`, `mapbox`↔`mapbox-satellite`, `google`↔`google-satellite`, `azure`↔`azure-maps-imagery`. Status reads “saved z12–18 · live fills gaps”, or “live” when nothing is saved here. Selecting it paints saved tiles on top of the live raster, with live only in the gaps.
- **Imports group by family, not by slug.** Match `providerLabel`, label, and slug against: Navionics, C-Map, NV Charts, Garmin, o-charts, Sat2Chart, NOAA, CM93. Two or more sets that share a `providerLabel` and match no family still group. Anything else is its own row, and only if it overlaps the view.
- The row subtitle is the area count, zoom span, and newest `sourceDate` or `acquired_at` among the files that overlap.
- “6 areas” expands **inside the row** to the overlapping file names. Tap one name to paint only that file. Tap the row to paint every overlapping file of that family. The expanded names are still only the files in this view.

Status on a row:

| Line | When |
| --- | --- |
| `on this boat · N areas · zA–B` | Imported files overlap, and this zoom is inside their range |
| `saved zA–B · May 2026` | Harvested files overlap at this zoom. Add `· live fills gaps` when a twin exists |
| `zoom to z14` | Overlaps the view, other zoom. Stays in the list, dimmed, so zooming does not make rows pop in and out |
| `live` | Internet imagery for this region, nothing saved here |
| `needs a key` | Greyed. Tap opens `SecretField` inline |
| `live tiles failing` | That source’s tile requests are failing (`bindBasemapErrors`). Dimmed |

Sort, under the pinned Auto row: nautical covering this zoom, then imagery covering this zoom, then wrong-zoom (dimmed), then live-only. Newest first inside a group. No “HERE / ONLINE ONLY / More” headings.

A file with no bounds after the meta read below does **not** join the main list. Those files would show in every ocean. They are counted on the Get-charts sheet as “coverage unreadable (N)”.

Hover or long-press outlines that row’s overlapping boxes with the existing amber `harvest-bbox` layer. The selected row stays outlined. The helm tablet has no hover, so the selected outline is the one that matters.

### Selecting is not downloading

The radio only changes the picture. Under the selected row:

- One line for this view. For a harvestable source, call the existing estimate and add a `missing` count from `countMissingTiles()` against the snapshot that overlaps. Run it for the **selected** source only, debounced, same as today’s estimate. Copy becomes “214 tiles still missing” (and a size when the estimate has one). Do not walk every source on `moveend`.
- **Download the rest** starts one job for this source and this view.
- **Keep filling as I pan** is the current Auto checkbox. Default **on**, remembered per source. It runs only while that source is the one on screen, and only when `provider.autoHarvest !== false`, zoom ≥ 8, under 400 tiles, inside quota and `exportLimitTiles`. Drop the hardcoded `NO_AUTO` set and trust `autoHarvest` plus `STUB_HARVESTERS`.
- An imported family with no harvester says “On this boat · not a download”.
- A live-only source with no harvest twin says “Live only · nothing is saved”.
- The line names the source and the tile count while a fill is running.

Auto does **not** download EOX (`default: true`) while the screen shows Navionics. The fill target is the chart on screen. EOX downloads when Auto or the user has actually selected EOX.

Jobs stay a collapsed list on this panel (chart and depth jobs together, today’s resume behaviour).

### Auto

Pinned first row. Default when `sisu-nav.basemap` is missing or unparseable. A saved `live:osm` stays OpenStreetMap; this boat does not get switched.

Pick order, recomputed on `moveend` (250 ms) as the view changes. The row shows the pick (“Navionics”).

1. Imported nautical family covering this zoom (most overlapping files, then newest).
2. Saved imagery covering this zoom (newest). A live twin fills gaps when tiles are loading.
3. Last live source the user chose by hand, if it is available.
4. OpenStreetMap (the style floor; `basemapDef('osm')` is already `null`).

Skip a keyed live source whose key is missing. Skip a live source whose tiles are currently failing, and use the saved half of a twin when it has one. Choosing any other row leaves Auto.

If the chosen source has nothing in the new view, leave the choice alone. The row says “nothing in this view”, the style floor stays, and the list shows what is here.

### Depth, inside the same panel, off the chart list

Depth is not a basemap. It stays out of the radio list so the chart list remains the one picker.

A single collapsed line: `Depth · Seascape · relief off`. Open it and the same overlap rules list depth sources for this view (BlueTopo, GEBCO, Seascape DEM / contours, EMODnet, GMRT, Esri Ocean, MapTiler Ocean, imported `kind: bathymetry`). BlueTopo stays behind Seascape when `/api/harvest/coverage` says the sample tile is empty, which is the BVI case even though `coverageBbox` contains the islands.

One source per overlay type (relief mutex, hillshade, contours), same as today. “Pin source” remains. Visibility stays on the Layers checkboxes `bathy-relief`, `bathy-hillshade`, `bathy-contours`. The line links to Layers. If a download finishes while its overlay is off, one button “Show relief” flips that existing layer flag so the download is visible. No second set of checkboxes.

The Bathymetry sidebar panel is removed. Painting stays in `plugins/bathy/overlay.ts`. Imported bathy sets still use `setImportOn` in `plugins/imported/state.ts`.

### Get charts and the NOAA / BVI case

Providers with `coverageBbox` that miss the view are omitted, with the reason on the Get-charts sheet. Providers whose box contains the view but whose product does not (NOAA ENC, BlueTopo at the BVI) stay off the main list until a saved snapshot actually overlaps. The sheet runs the existing coverage sample for the one provider you expand, not for every provider on every pan.

## Under the hood

### Coverage on `GET /api/tilesets`

Add `bounds`, `minZoom`, `maxZoom`, `provider`, `providerLabel`, `sourceDate`, `acquiredAt`. Read the sibling `meta.json` first (`bbox` or `bounds`, zoom, provider, dates). Call `peekMbtiles()` only when those are missing and the file is `.mbtiles`. `.pmtiles` stays meta-only. Cache by `path + mtime + size` so the 3 s poll does not reopen hundreds of SQLite files. Unknown stays null. Additive JSON; old clients ignore the new fields.

### Model

- `plugins/map/sources.ts` — `buildSources(live, providers, tilesets) → ChartSource[]`. Twins, families, depth vs chart via existing `kind`.
- `plugins/map/availability.ts` — pure `rankForView(sources, {bbox, zoom}, {keys, liveFailing}) → {auto, rows}`. Overlap uses `bboxIntersects` from `api/harvest/snapshots.mjs` (copy the four-number test into the client module; do not import server code into Vite). A view with `west > east` is split into two boxes so a Pacific crossing still matches. Recompute on `moveend` (250 ms) and when the tileset list changes.
- `basemap.ts` choice becomes `{kind:'auto'} | {kind:'source', id, file?: string}`. `file` is set only when a single area inside a family is chosen. `parseBasemap` maps old values: `live:esri` and `harvest:esri-world-imagery` → `esri`; `imported:<slug>` → that slug’s family (or the slug row); `live:osm` stays the OSM source; empty/unknown → `auto`.

### Painting (`MapView.tsx` `applyTilesets` + `basemaps/overlay.ts`)

Do this **before** the grouped row becomes selectable. A Navionics row that adds every archive on the boat will stall the map.

- Add local sources only for files of the choice that overlap the view, plus about one screen of margin. Remove sources that fall outside that.
- Set `bounds`, `minzoom`, and `maxzoom` on each raster source from the catalog.
- For a twin, add the live raster first, under the offline rasters, both before `track-line`, so gaps show live imagery and the OSM style stays the floor.

### What is removed

- Charts `<select>`, including its imported `<optgroup>`.
- Imported sidebar plugin (`slot: 'panel'`). Inbox UI moves into the drawer. `ImportedSets.tsx` radios go away. Bathy import toggles move to the Depth disclosure.
- Bathymetry sidebar plugin. `BathyPanel.tsx` logic moves; `bathy/overlay.ts` stays.
- Keep plugin id `harvest` and title `Charts`, so a saved sidebar order (`sisu-nav.side`) still finds the panel. Dropped `imported` and `bathy` ids already disappear in `resolveSide`.

No env, secret, port, or compose change. `sisu-nav/INSTALLATION.md` stays as it is.

## Step 0

File the issue before any code (`CLAUDE.md`). Labels `enhancement,P2,sisu-nav`. Claim `agent:grok`.

**Touches**

- `sisu-nav/api/server.mjs`, `sisu-nav/api/harvest/mbtiles.mjs`, `sisu-nav/api/harvest/jobs.mjs` (estimate `missing` only)
- `sisu-nav/web/src/app/config.ts` (`Tileset`)
- `sisu-nav/web/src/plugins/map/{basemap.ts,sources.ts,availability.ts,MapView.tsx}`
- `sisu-nav/web/src/plugins/basemaps/{BasemapsPanel.tsx,overlay.ts}`
- `sisu-nav/web/src/plugins/harvest/*`
- `sisu-nav/web/src/plugins/imported/*` (panel removed; inbox becomes the drawer; `state.ts` kept for bathy toggles)
- `sisu-nav/web/src/plugins/bathy/*` (panel removed; `overlay.ts` stays)
- `sisu-nav/web/src/plugins/layers/LayerPicker.tsx` (anchor for the Layers link, if needed)
- `sisu-nav/USER_GUIDE.md`, `sisu-nav/DEVELOPER.md`, `sisu-nav/README.md`
- `.ai_context/feature_map/nav/charts/{basemap,harvest,imported}.{md,sh}`, `.ai_context/feature_map/nav/bathy/panel.{md,sh}`
- root `plan.md` (this text)

## Order of work

1. **Catalog.** New tileset fields + cache. `curl` `/api/tilesets` on the F8: bounds present, second call fast with a few hundred files.
2. **Model.** `sources.ts`, `availability.ts`, choice migration. Check the BVI fixture in a small `node --experimental-strip-types` script next to the pure module (no new test runner): a Grenada-only file is absent, six Navionics files are one row, Esri live+harvest is one row, NOAA is absent from the main list, Bing is absent as a live row, Azure is present.
3. **Painting.** Viewport-scoped sources, per-file bounds, live under offline. Still driven by the old choice, so this can be checked before the new list exists.
4. **The list.** Replace the Basemap `<select>`. Auto, badges, dimmed wrong-zoom, selected outline, key field. Remove the Imported radios in the same step so two pickers never ship together.
5. **Actions.** Detail block, `missing` on estimate, per-source fill, jobs, Get-charts sheet, USB drawer. Delete the Imported panel.
6. **Depth disclosure.** Move BathyPanel’s source, pin, coverage hint, and download. Delete the Bathymetry panel. Layers keeps on/off.
7. **Docs and deploy.** Feature-map pairs updated, `lint.sh` green. `./scripts/scan_secrets.sh`. `./scripts/stack-drift.sh f8` before and after `./scripts/f8-deploy.sh`.

## Acceptance

- [ ] Charts is the only sidebar control that sets the basemap. Imported and Bathymetry panels are gone. Layers, weather, and the other panels are unchanged.
- [ ] At the BVI the list is Auto, the families and live imagery available there, and nothing else. A Grenada-only file is absent. A file that overlaps at another zoom stays, dimmed, with “zoom to zN”.
- [ ] Hundreds of areas are one row per family, with a count. Expanding the row lists only areas in this view. One area can be painted on its own.
- [ ] Esri, Google, Mapbox, and Azure each appear once. Saved tiles and the live service share the row. Azure is labeled as the Bing replacement. No live Bing row.
- [ ] A missing key greys the row and opens the key field on the row.
- [ ] Download the rest and Keep filling as I pan sit under the selected chart, default on, existing zoom / 400-tile / quota / `autoHarvest` guards. The fill target is the chart on screen. The line shows source and tile count while it runs.
- [ ] Auto is the default only when nothing is saved. A saved `live:osm` stays OSM. Auto’s order is imported nautical, saved imagery, last live choice, OSM, and the row names the pick.
- [ ] Nautical imports are chart rows. `bathymetry` sets and depth providers appear only in the Depth disclosure.
- [ ] Depth on/off stays in Layers. The disclosure shows the state, links to Layers, and can show the overlay after a download.
- [ ] Get charts can start a harvest for a provider that has nothing here, and says when the provider does not cover the view.
- [ ] The selected row outlines its boxes on the map. Long-press does the same.
- [ ] A live source with failing tiles is dimmed, and Auto skips the live half.
- [ ] Old `live:` / `harvest:` / `imported:` values map to the right source.
- [ ] MapLibre adds sources only for in-view files and does not request tiles outside file bounds.
- [ ] `/api/tilesets` stays quick across a few hundred files.
- [ ] USER_GUIDE, DEVELOPER, README table, and the feature map match the panel. `lint.sh` and `./scripts/scan_secrets.sh` pass. F8 deploy is in sync (`stack-drift.sh f8`).

## Out of scope

- Tile-exact footprints inside a bbox. Bounds plus zoom are enough. Harvest sets are rectangles.
- A live Navionics or Bing service. Navionics stays imported. Bing stays retired.
- New providers.
- OpenSeaMap, which remains a Layers mark overlay.
