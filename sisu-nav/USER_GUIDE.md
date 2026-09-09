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

- **Map** (center) — the chart, always present.
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

The **Layers** button (top of the map, not a stack panel) opens the overlay
picker — every map layer in the app, on/off, in one list. A row can be
unavailable for two different reasons, both shown as a grey row with a
reason underneath it:

- **"not yet"** — the layer is a placeholder for a future issue, nothing to
  turn on yet (e.g. `rain`, `radar`, `clouds` at time of writing).
- **"one at a time (off `<other>` first)"** — a **mutex group**: only one
  member can be on. Turning one on automatically greys its siblings until
  you turn it back off. Current groups: `particles` (weather particles vs
  dust), `ensembles` (only one ensemble spaghetti set — IFS/AIFS/GEFS — at a
  time; 50+ member lines from two models at once is unreadable),
  `bathy-relief` (one seafloor-relief source at a time), and
  `basemap-live` (one live satellite/street basemap at a time — Esri
  World Imagery, OpenStreetMap, and Mapbox Satellite today; Google/Bing
  listed but not yet built).

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

## Ensemble wind

The Open-Meteo **Ensemble API**, ECMWF IFS ENS (51 members) — the "spaghetti
plot" gold standard for offshore passage planning. Turn on
**Ensemble wind (ECMWF IFS)** in Layers to see it (`ens-ecmwf` in the
`ensembles` mutex group — the AI-ensemble AIFS and backup GEFS rows are
listed but stay stub for now, follow-up issues).

- Default is **clustered**: the control run plus 10 evenly-spaced members —
  readable at a glance.
- **Deep** (checkbox in the panel) fetches all 51 members — a heavier
  fetch, use it when you actually need to see the full spread, not as the
  default.
- The **time slider** steps through the forecast horizon (~15 days).
- Click a line for a per-member table (TWD/TWS) at that cell — useful for
  seeing exactly how much the members disagree at a specific point and time,
  rather than just eyeballing spread on the map.

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

Historical wind-direction/speed distribution, built server-side from this
boat's own Influx `Sisu_1m` data (not a forecast) — useful for "what does
wind actually do here in this season" planning.

Query modes: **last N days**, **last N months**, or a specific
**month-of-year** (aggregated across all logged years) — pick the mode from
the dropdown, adjust N or the month, then click a rose cell on the map for
the underlying sample detail.

## Notes

Simple map pins with a name/description/URL, useful for marking anchorages,
hazards, or points of interest as you cruise.

- **Add note** then click the map to place it; fill in the form that
  appears.
- Click an existing note to view/edit or delete it.

## Basemap (live)

A **Basemap** panel shows which live basemap (if any) is active. These are
the opposite of Charts below: nothing is saved to disk, they're fetched
fresh every time you have internet, and turn back into the default chart
the moment you're offline or toggle them off. Turn one on in Layers
(mutex group `basemap-live` — only one at a time):

- **Esri World Imagery** / **OpenStreetMap** — free, no setup.
- **Mapbox Satellite** — needs `MAPBOX_ACCESS_TOKEN` configured
  (`INSTALLATION.md` §3); greyed out until it is.
- **Google Satellite** / **Bing Aerial** — listed for visibility, not
  built yet.

Want this basemap available with no internet later? That's what **Charts**
below is for — a live basemap here doesn't get you offline coverage, only
a harvest job does.

## Charts (dated tile harvest)

Downloads dated satellite/nautical tile sets for offline use, from the
provider list in `api/providers.yaml` — including Mapbox/Google/Bing/Apple,
each requiring your own API key; see that file's header comment for the
accepted-risk reasoning behind allowing them.

- Pick a **provider** from the dropdown. A provider needing a paid key you
  haven't configured (`INSTALLATION.md` §3) shows as blocked, not silently
  broken.
- The panel shows a **tile-count estimate** for your current map viewport
  before you commit to a download — some providers cap the estimate and
  refuse to start over the limit (narrow the view instead of overriding it).
- **Start** begins the job; it appears in the **Jobs** list with progress,
  and can be **resumed** if interrupted (container restart, network blip) —
  jobs are not lost, just paused.

## Bathymetry

Same harvest mechanics as Charts, scoped to seafloor-relief/contour tile
sources (`kind: bathymetry` in the provider registry). At time of writing
this is a **floor only** — no live bathymetry provider is wired in yet
(follow-up issues #98/#99/#100), so the panel exists and works but the
provider list may be empty or entirely stub until those land.

## Layout gear

The **Layout** button next to the "Sisu" header (top of the right-hand
stack) toggles edit mode for the stack itself — which panels are visible,
hidden, and in what order (checkboxes + ↑/↓ per panel). The same toggle
also switches Instruments into its drag-and-edit mode (see
[Instruments](#instruments) above) — it's one shared edit state, not two
separate controls. Reordering and hide/show are saved per browser/device,
so don't expect your phone and your chart-table laptop to show the same
arrangement unless you set both up the same way.
