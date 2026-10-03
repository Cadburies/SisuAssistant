# Sisu Nav — User Guide

> How to use the cockpit UI once it's running. For deploy/build, see
> [INSTALLATION.md](INSTALLATION.md). For how it's built (API + plugins),
> see [DEVELOPER.md](DEVELOPER.md).

**Sisu Nav is advisory only — there is no autopilot integration.**
PredictWind and DataHub stay the offshore/human backup; internet weather
layers here are a passage-planning aid, not a substitute for instrument
readings or professional routing.

## Layout

Opening the app (`http://<host>:8088`) gives you three regions:

- **Map** (center) — the chart, always present. **Follow me** (top-left)
  pans to this device's GPS, not AIS/Signal K Sisu (gold boat). The browser
  only shares that location on a secure page. On the boat open
  `https://192.168.0.21:8443`, accept the certificate warning once, then
  allow location. The plain `http://192.168.0.21:8088` page links there.
- **Right-hand stack** — a column of panels, one per plugin. Which ones show
  and in what order is yours to set (see [Layout](#layout-gear) below); it's
  saved per-browser, not shared between devices.
- **Status bar** (bottom) — Signal K connection state, your position, SOG,
  a **☾ Night / ☀ Day** theme toggle, and a sign-in/sign-out control. Until
  Signal K is connected and logged in, panels that need live data (Windex,
  Instruments) show blanks.

**Day/night theme:** Night (the default, and the app's only look before
this) is a dark instrument-panel style with glowing accents. Day is a
high-contrast light theme for bright on-the-water conditions, same color
identity, toned down for daylight legibility rather than switched off — the
toggle in the status bar swaps between them, saved per-browser. It doesn't
follow your OS's light/dark setting automatically; it only changes when you
click it. See [DESIGN.md](DESIGN.md) if you're curious how the color system
works.

Signal K on this vessel requires a login. If the status bar shows
"Signal K login", enter your SK username/password there — the browser talks
to Signal K directly, `sisu-nav-api` is not in that path.

## Layers

The **Layers** button (top of the map, not a stack panel) opens the
**overlay** picker — wind, rain, clouds, radar, dust, AIS, bathymetry,
currents, cables, OpenSeaMap marks, ensembles, waves, provisions, aircraft,
and satellites. The **basemap** is
not in this list: pick it in the Charts panel. The list scrolls when it is taller than the remaining map height.
A row can be unavailable for two different reasons, both shown as a grey
row with a reason underneath it:

- **"not yet"** — the layer is a placeholder for a future issue, nothing to
  turn on yet.
- **"one at a time (off `<other>` first)"** — a **mutex group**: only one
  member can be on. Turning one on automatically greys its siblings until
  you turn it back off. Current groups: `particles` (weather particles vs
  dust), `ensembles` (only one ensemble spaghetti set — IFS/AIFS/GEFS — at a
  time; 50+ member lines from two models at once is unreadable), and
  `bathy-relief` (one seafloor-relief source at a time).

Toggle state persists per-browser (not per-boat) — a fresh browser sees the
catalog's defaults (AIS, weather wind, and wind-discrepancy layers on by
default).

## Windex

Traditional wind-instrument dial: True Wind Direction (outer needle) and
Apparent Wind Angle (inner needle), driven off the live Signal K feed.

- **Head up / North up** — toggles whether the rose rotates with the boat's
  heading (head-up, sailor's usual default) or stays fixed to true north.
- **Dock / Full** — expands the dial to fill more of the stack when you want
  a bigger read at a glance, or shrinks it back to make room for other
  panels.

## Instruments

A customizable grid of live metrics (SOG, depth, etc. — whatever cells you
add), read from the Signal K feed.

- Click **Layout** in the right-hand stack header (see
  [Layout gear](#layout-gear) below) to enter edit mode — the same toggle
  that lets you reorder/hide panels also puts the Instruments grid into
  drag-and-edit mode; there is no separate Instruments-only edit control.
- In edit mode: drag rows to reorder, add a metric cell to a row (disabled
  once a row hits its per-row cell limit — shown as a tooltip), or add a
  new row entirely.
- Layout (which cells, which order) is saved per-browser, same mechanism as
  panel ordering.

## Weather

Multi-model wind forecast, drawn on the map (not the same thing as
instrument TWD/TWS — this is an internet forecast). Models available:
GFS, ECMWF IFS, ICON, GEM (Open-Meteo, `cell_selection=sea` so land cells
don't pollute coastal readings).

- **Weather wind** — the blended/selected model's vector field.
- **Wind discrepancies** — where models disagree meaningfully; useful for
  judging forecast confidence before committing to a routing decision.
- **Weather particles** — animated flow visualization (mutex with `dust`).
- Click a cell on the map (with a wind layer on) for the per-model detail at
  that point.
- The **time slider** is in your device's local timezone (not UTC).

## Ensemble wind

The Open-Meteo **Ensemble API**, ECMWF IFS ENS (51 members) — the "spaghetti
plot" gold standard for offshore passage planning. Turn on
**Ensemble wind (ECMWF IFS)** in Layers to see it (`ens-ecmwf`). **AI
ensemble (AIFS)** and **Backup ensemble (GEFS)** are the same spaghetti
pattern; only one ensemble at a time (`ensembles` mutex).

- Default is **clustered**: the control run plus 10 evenly-spaced members —
  readable at a glance.
- **Deep** (checkbox in the panel) fetches all 51 members — a heavier
  fetch, use it when you actually need to see the full spread, not as the
  default.
- The **time slider** steps through the forecast horizon (~15 days), in
  local time.
- Click a line for a per-member table (TWD/TWS) at that cell — useful for
  seeing exactly how much the members disagree at a specific point and time,
  rather than just eyeballing spread on the map.

## Waves / swell

Open-Meteo **Marine** forecast of significant wave height (Hs) and direction
— comfort and knockdown risk, not instrument TWD/TWS. Turn on **Waves /
swell** in Layers (`waves`; no mutex, it combines with the wind layers).
Off by default.

- Fill colour is Hs (calm → knockdown). Ticks show wave direction
  (meteorological, coming-from), same convention as the wind barbs.
- Prefers **ECMWF WAM 0.25°** (`ecmwf_wam025`, no API key,
  `cell_selection=sea`). That grid is coarse versus Caribbean island jets;
  still the right v1. The panel names whichever model actually returned.
- Swell vs wind-sea get separate ticks only when both series populate.
  ECMWF WAM typically returns combined sea only — the panel says so rather
  than inventing a split.
- The **time slider** steps through the ~48 h horizon in local time. Click a
  cell for Hs and direction at that point.

## Currents

Open-Meteo **Marine** surface current (Meteo-France SMOC, ~8 km, hourly) —
Gulf Stream / island jets as a passage-planning overlay, not a log or
ADCP. Turn on **Currents** in Layers (`currents`; no mutex, arrows combine
with wind particles and waves). Off by default.

- Arrows point **towards** (where the water is going): 0° north, 90° east.
  Colour and size follow speed (0–4 kn+).
- Model is `meteofrance_currents`, `cell_selection=sea`, speed in knots.
  No API key. The 8 km grid is coarse versus Caribbean island jets; still
  the right v1 (Copernicus is not wired — SMOC returned plausible BVI /
  Grenada vectors).
- The **time slider** steps through the ~48 h horizon in local time. Click
  an arrow for speed and direction at that cell.

## AIS (global)

Internet-sourced AIS traffic (AISStream.io) — a completely separate feed
from the **AIS** layer above, which is your boat's own receiver (VHF range
only). Turn on **AIS (global, internet)** in Layers to see it: violet dots
distinct from the boat-icon local-AIS traffic, click one for MMSI/name/SOG.

Useful for passage planning — seeing what's near a destination or beyond
your own receiver's horizon — but it's internet data on a ~1 minute poll,
**not** a substitute for your own AIS/radar/lookout for collision avoidance.
Off by default; requires the vessel operator to have configured
`AISSTREAM_API_KEY` (free signup at aisstream.io) — if it's not configured,
the panel just says so rather than showing stale or fake data.

## Hazards

Anchoring hazards — currently **submarine telecom cables**, fetched live
from TeleGeography's cable map (© TeleGeography, shown as attribution in
the panel). Turn on **Submarine cables** in Layers: cables draw as
colored lines (colors match TeleGeography's own map), landing points as
small dots (dimmer ones are planned/not-yet-laid). Click either for a
name.

This is one dataset fetched once per session (it changes on a
"new cable laid" timescale, not something worth re-polling), and it's a
planning aid, not a substitute for checking a real chart or local
knowledge before you actually drop anchor. Off by default so it doesn't
clutter the chart until you're specifically thinking about ground tackle.

## OpenSeaMap marks

Live nautical marks (buoys, lights, day-marks) from OpenSeaMap, drawn on
top of whatever Charts basemap you picked. Turn on **OpenSeaMap marks** in
Layers. No API key. Marks show from about zoom 9. This is **not** a chart
and not for navigation — ENC / paper remain the plotter. Attribution
© OpenSeaMap © OpenStreetMap.

## Sky (rain, clouds, radar, dust)

Internet forecast overlays (Open-Meteo + RainViewer). Toggle **Rain**,
**Clouds**, **Radar**, or **Dust** in Layers. Dust is mutex with weather
particles (one particle-style field at a time). Radar uses RainViewer tiles
(no key). Not instrument. Time slider is local.

## Provisions / POI

Shops, restaurants, bars, fuel, chandlery, marinas from OpenStreetMap via
Overpass, **this map view only**. Toggle **Provisions / POI** in Layers.
Click a point for name. © OpenStreetMap contributors (ODbL). No key.

## Aircraft

Live ADS-B in the current view (adsb.lol). Toggle **Aircraft** in Layers.
Not collision-avoidance. Attribution adsb.lol (ODbL).

## Satellites overhead

Ground-track dots for satellites whose footprint is in the current view,
from CelesTrak TLEs. Toggle **Satellites overhead** in Layers. Click for
name/NORAD. Not “visible tonight” pass prediction. CelesTrak (celestrak.org),
Dr. T.S. Kelso.

## Route

Isochrone-based routing between two points, using your boat's polar plus
forecast wind. Three modes (pick one before planning):

- **Minimize ETA** — fastest route by pure forecast wind.
- **Prefer multi-model agreement** — favors headings where the weather
  models (GFS/ECMWF/ICON/GEM) agree, at some ETA cost, as a hedge against a
  forecast bust.
- **Prefer ensemble-member agreement** — same idea using ECMWF ensemble
  member spread rather than cross-model disagreement.

Workflow: click **pick start/destination** and click the two points on the
map (or use the current position as start), **Plan** to compute and draw
the route, then **Commit** if you want to save it to Signal K as a route for
later reference. Planning is advisory math over a forecast — always
sanity-check the drawn track against the chart and current conditions
before actually steering to it.

## Wind roses

This boat’s measured TWD + AWS from Influx `Sisu_1m`. **Community** is an
opt-in shared map of aggregated roses (geohash cells, month resolution).
Sharing is **off by default**; it never uploads raw tracks. Other boats’
cells only appear when at least three boats contributed to that cell.

Historical wind-direction/speed distribution, built server-side from this
boat's own Influx `Sisu_1m` data (not a forecast) — useful for "what does
wind actually do here in this season" planning.

Query modes: **last N days**, **last N months**, or a specific
**month-of-year** (aggregated across all logged years) — pick the mode from
the dropdown, adjust N or the month, then click a rose cell on the map for
the underlying sample detail.

### Anchor spots

**Source → Anchor spots** shows one rose per spot Sisu has anchored, built
automatically — nothing to switch on. Every 15 minutes Sisu Nav looks back
through the logged history for stretches where the boat stayed put with
the engines off and low SOG, **and** either swung on its rode (heading
moving with the wind) or had the anchor alarm armed. A dock or slip on lines
doesn't swing, so it's left out. Each anchored hour adds that hour's wind to
the rose for that spot.

- **Spots, not bays.** Spots more than 100 m apart stay separate, so the
  south and north ends of one bay each get their own rose. Zoomed out the
  roses shrink; zoom into the anchorage to tell spots apart. The list in the
  panel jumps to a spot.
- **Click a spot** for hours anchored, visits, last time there, max wind,
  swing radius, and **steadiness**: near 1 means the wind holds one
  direction, low means it (and the boat) goes all over the place —
  the thing terrain does at the wrong end of a bay.
- **Location** is the anchor alarm's drop point when it was set, otherwise
  the middle of everywhere the boat swung, which sits close to the anchor.
- A spot needs wind data: if the instruments were off the whole time,
  no rose appears.
- **Detect now** runs the check immediately instead of waiting for the next
  15-minute cycle.
- Spots are also sent to **SisuMate** (same Supabase project) about once an
  hour, so the app sees them too. Offline is fine: they're kept on the F8
  and sent when the connection is back. The status line says when it last
  synced, or "local only" if sync isn't set up (see `INSTALLATION.md`).
- **Share my roses** (same opt-in as above, off by default) also adds your
  anchor-spot roses to the community map, at spot resolution (~150 m). Like
  all community cells, a spot only shows to other boats once at least three
  boats have shared one there, and it's sent under an anonymous id — not
  your SisuMate boat.

## Notes

Simple map pins with a name/description/URL, useful for marking anchorages,
hazards, or points of interest as you cruise.

- **Add note** then click the map to place it; fill in the form that
  appears.
- Click an existing note to view/edit or delete it.

## Charts

Charts is the only sidebar control for the picture under your feet. The list
is this view: imported families that overlap (Navionics and the rest, one row
however many files), saved harvests, and live imagery that works here
(OpenStreetMap, Esri, Google, Mapbox, Azure). Saved Bing zones sit on the
Azure row, ArcGIS on Esri, and Google satellite on Google. Navionics sonar
is its own row. Azure live imagery fills gaps where a saved Bing zone has
no tile.
A chart with nothing in this view is not a row — **Get charts for this view**
holds it, with the reason when you open that source. **Add from USB** is the
inbox. Layers still sit on top.

**Auto** is the first row. It picks imported nautical charts that cover this
zoom, then saved imagery, then the last live source you chose, then
OpenStreetMap. A saved OpenStreetMap choice stays OpenStreetMap. Picking any
other row leaves Auto. If that chart has nothing in the new view, the row
says so and the map keeps the OpenStreetMap floor.

The header names a coarse place when the view sits in one (BVI before USVI)
and otherwise shows the centre, like `18.4°N 64.6°W · z13`. A family row’s
count expands to the areas in this view. Tap one area to paint only that
file. Tap the row to paint every overlapping file. The selected row outlines
those boxes on the chart. A long-press does the same.

Under the chart on screen:

- **Download the rest** saves this view for that source. It does not run just
  because the row is visible.
- **Keep filling as I pan** is on by default, remembered per source, and only
  runs while that chart is the one on screen. It waits until zoom 8 or closer,
  under 400 tiles, inside the quota and the provider’s export limit. It stays
  off when the provider’s `autoHarvest` is false (NOAA, Google, Azure) and
  for stubs (Maxar, Planet, MapTiler Satellite).
- An imported chart with no downloader says **On this boat · not a download**.
- A missing key greys the row. The field under it saves the key on the server.

**Jobs** stays collapsed at the bottom. **filled N** is tiles written.
**filled 0 — none landed** means the request finished with nothing stored.
**Resume** continues an interrupted job.

**Depth** is the collapsed line under the list, not a basemap.
**Not for navigation.** It lists seafloor sources that overlap this view
(BlueTopo, GEBCO, Seascape, EMODnet, GMRT, Esri Ocean, MapTiler Ocean, and
imported bathymetry). BlueTopo stays behind Seascape when the coverage sample
for this view is empty, which is the BVI case. **Pin source** keeps your
pick. On and off stays in Layers (relief, hillshade, contours). **Show
relief** turns that layer on after a download. The same download and fill
controls apply to the depth source.

## Imported charts (USB / drop-in)

Copy chart archives you **already have** (`.mbtiles` / `.pmtiles`, or an OSM
XYZ `{z}/{x}/{y}.png` folder) onto the boat box. Sisu Nav will not decode
Navionics / C-MAP / Garmin / UKHO app caches — convert or export to one of
those formats yourself first.

Keep the folder name you already use. Do not rename the zones.

```text
tiles/manual/<place>-<product>-<yyyy-mm>/<same-name>.mbtiles
```

The product word is the chart row: `navionics`, the same name plus `sonar`,
`arcgis` (Esri), `bingsat` (Azure), `googlesat` (Google). A name with
`satellite` and no vendor is one Satellite row. A `meta.json` beside the
file is optional; the folder name is enough for the row. Files already in
`tiles/manual/` show up on their own. The drawer does not copy them again.

For a new dump that is not in `tiles/manual/` yet:

1. Put it in the **inbox** (`sisu-nav/tiles/inbox/` on Mac, or bind-mount
   a USB/NAS folder over `/data/import` on F8).
2. Open **Charts → Add from USB**. Open the folder that holds the zone
   folders.
3. **Import all in this folder** copies the archives in that folder and one
   level of zone folders. The product word sets nautical or satellite. The
   kind dropdown applies only when the name does not say. **Import selected**
   is the same rule for the files you check.

Nautical and satellite sets join the Charts list when this view overlaps
them. Bathymetry sets show under **Depth**.

**Mac:** only import a small test folder. A circumnavigation dump will fill the
disk. The drawer warns above ~32 GB and refuses unless you confirm.

**F8:** mount the full dump as the inbox and import everything — no size warn.

## Layout gear

The **Layout** button next to the "Sisu" header (top of the right-hand
stack) toggles edit mode for the stack itself — which panels are visible,
hidden, and in what order (checkboxes + ↑/↓ per panel). The same toggle
also switches Instruments into its drag-and-edit mode (see
[Instruments](#instruments) above) — it's one shared edit state, not two
separate controls. Reordering and hide/show are saved per browser/device,
so don't expect your phone and your chart-table laptop to show the same
arrangement unless you set both up the same way.

## Settings

The **Settings** panel lists every API key Sisu Nav can use. Paste a value
and **Save** — it is stored on the boat in a gitignored local file, never
shown in full again (status is a masked preview like `••••1234`).

- Configured keys show whether they came from this panel or from
  `secrets.yaml` / compose env.
- **Clear local** drops the Settings override so the env/secrets value
  applies again.
- Bing Maps and Apple Maps rows are visible but disabled (**Not
  implemented yet**) until those harvest paths exist (#117). Bing live
  imagery is Azure Maps now — that key is a real row.
- Reload the page after saving Mapbox / Google / Azure if you want the
  live basemap to pick up the new token.

Charts can still save harvest keys into `secrets.yaml` (#102).
If both places set the same key, Settings wins.
