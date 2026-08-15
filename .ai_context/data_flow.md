# Data flow synthesis (HA ↔ MQTT ↔ Signal K ↔ Spectra)

Cross-file pipeline only. No full entity inventory — grep source for names.  
**Hosts / SSIDs / F8 / Grafana:** repo root **`NETWORK.md`**.

## Device platforms

| Device | Hardware | Ingress to HA |
|--------|----------|----------------|
| Alternator Port/Starboard | **Sisu Marine Board** (prod) | HA API; lab: **T8 dual-sim** `bench_alts_sim` @ `.49` |
| Tank levels | **Sisu Marine Board** | HA: House Voltage + Fresh Water · Aft/Fwd (when online) |
| Freezer / fridge | **LilyGo S3 AMOLED** | HA: Freezer Temperature / Thermostat |
| Spectra Newport 400c | Spectra controller **192.168.0.25:9000** | HA: `python_scripts/spectra_ws.py` + `packages/spectra_newport.yaml` |
| NMEA 2000 instruments | **YDWG-02** `.10.30` (primary) → **DataHub** `.10.31` (failover) | HA: `python_scripts/nmea_gateways.py` + `packages/nmea_gateways.yaml`; SK TCP 0183 on F8 |

Naming authority: `.ai_context/naming.md`. Lab→prod entity map: `packages/sim_production_aliases.yaml`.

## Primary pipeline (alternators)

```
Marine Board ESPHome (API)   [or lab bench_alts_sim]
  → Home Assistant entities
  → automation: mqtt.publish JSON   [requires MQTT integration → F8]
  → Mosquitto topic signalk/electrical/alternators/{side}
  → Signal K plugin signalk-mqtt-sensors
  → self.electrical.alternators.* paths
```

| Stage | Authoritative file |
|-------|-------------------|
| Device logic & entities | `packages/marine_alternator.yaml` + `alternatorport` / `starboard` |
| Lab simulator | `esphome/bench_alts_sim.yaml` |
| Republish trigger & JSON | `homeassistant/automations.yaml` |
| Broker (production) | **TerraMaster F8** Mosquitto (`mqtt_broker` in secrets) |
| Broker (repo sample) | `homeassistant/mosquitto/config/mosquitto.conf` |
| Topic → SK path map | `homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json` |
| SK server (production) | Docker on **F8**; sample under `homeassistant/signalk/` |

## MQTT JSON keys (SK-friendly)

`current`, `voltage`, `temperature` (K), `pwmRatio` (0–1), `chargeStage`, `currentSetpoint`, `temperatureSetpoint` (K), `status`, `location`

## Units contract

- Device / HA temperature: **°C**
- MQTT + Signal K temperature: **Kelvin**
- Level HA **%** · SK **0–1** when mapped
- Field duty HA **%** · MQTT **pwmRatio** 0–1

## NMEA 2000 instruments (YDWG primary → DataHub failover)

```
N2K backbone
  → Yacht Devices YDWG-02  192.168.10.30  TCP NMEA0183 :1456   ★ primary
  → PredictWind DataHub    192.168.10.31  TCP NMEA0183 :11102  ★ failover
       │
       ├─ HA Green: nmea_gateways.py health/status (prefer YDWG if TCP up)
       │     → sensors nmea_* / binary_sensor.ydwg_online / datahub_online
       └─ Signal K (F8): both pipedProviders enabled (settings.json)
```

| Stage | Authoritative file |
|-------|-------------------|
| Policy + parser | `python_scripts/nmea_gateways.py` |
| HA entities | `packages/nmea_gateways.yaml` |
| Helm tiles | `dashboards/helm.yaml` |
| SK connections | `homeassistant/signalk/settings.json` (`ydwg-nmea0183`, `datahub-nmea0183`) |
| Secrets | `YDWG_URL`, `PREDICTWIND_HUB_LOCAL_URL`, optional `ydwg_nmea_port` / `datahub_nmea_port` |

Web admin passwords are **not** used for the NMEA TCP stream.

**Engine data (Yanmar 4JH45 ×2, via YDEG-04 → SeaTalkNG → YDWG-02, confirmed live 2026-08-09, issue #25):** YDWG-02's `$YD…`-wrapped NMEA0183 sentences carry full N2K PGNs (127488/127489/127508), which Signal K's NMEA0183 parser auto-unwraps — no separate raw-N2K plugin needed. Live at `propulsion.{port,starboard}.*`: `revolutions`, `temperature` (K), `oilPressure` (Pa), `alternatorVoltage`, `fuel.rate` (m³/s), `runTime` (s, engine hours), `engineLoad`, `boostPressure`; `electrical.batteries.{0,1}.voltage` (per-engine starter battery); ~24 `notifications.propulsion.{port,starboard}.*` alarm flags each (overTemperature, lowOilPressure, checkEngine, etc).  DataHub does **not** carry any of this (nav/instrument PGNs only) — YDWG-02 is the only source.

**HA-side (issue #25, built):** `signalk-mqtt-bridge` is enabled but publishes in a Victron-VenusOS-style `N/<id>/...` + keepalive protocol that did not yield propulsion data under test (plugin's own topic namespace, separate from the plain-path `signalk-mqtt-sensors` convention) — not pursued further. Went with Signal K's own REST API instead: `python_scripts/signalk_engines.py` logs in fresh each call (`SignalKUser`/`SignalKPwd`, non-expiring token observed but not cached), polls `vessels/self/propulsion` + `electrical/batteries` + `notifications/propulsion`, flattens to display units (RPM, °C, bar, L/h, % , hours). Exposed via `packages/signalk_engines.yaml` (`command_line` JSON sensor + per-field `template` sensors + per-side alarm `binary_sensor`, same pattern as `spectra_status_json`). Dashboard: `dashboards/engine.yaml` "Port Engine"/"Starboard Engine" cards, alarm-first priority order.
Only **one** logical HA source at a time (`sensor.nmea_active_source`). SK may see both feeds if both online — prefer filtering duplicates in SK UI if needed.

## Persistent NMEA wind listener — real-time gust capture (issue #37)

```
YDWG-02 / DataHub (same gateways as above)
  → homeassistant/nmea_wind_daemon/ (Docker container, Mac stack for now)
      persistent TCP connection, never reconnects on a schedule --
      only on an actual drop; tracks a rolling gust max in-process
  → MQTT sisu/nmea/wind/{aws,aws_gust,tws,tws_gust,awa}, throttled ~1Hz
  → HA mqtt: sensor entities (packages/nmea_wind_live.yaml)
      sensor.nmea_aws_live / _gust, nmea_tws_live / _gust, nmea_awa_live
  → InfluxDB (trending_influxdb.yaml include list)
```

**Why a second pipeline instead of just polling the existing one faster** (measured live 2026-08-15): the wind instrument transmits a fresh MWV reading every ~0.5s (~2Hz), but `nmea_gateways.py`'s `command_line`-polled pipeline (`sensor.nmea_aws`/`nmea_tws`/`nmea_awa` etc, still the source for heading/direction and the WeatherAWA/WeatherTWD dashboards' non-gust panels) opens a fresh TCP connection for a ~2s sample once every 15s and keeps only the *last* line seen — blind ~87% of the time, and discarding ~75% of what it does see even during the ~13% it's listening. A short (1-2s) gust has a real chance of being missed entirely, not smoothed. This daemon stays connected continuously and feeds every single reading (parsed one line at a time, not batch-parsed, specifically so nothing gets dict-overwritten before it's counted) into an in-memory rolling-max tracker — full ~2Hz sampling resolution — then reports at a deliberately throttled ~1Hz so InfluxDB/HA aren't flooded for no benefit.

**Restart safeguards** (layered, not just "Docker will restart it"): Docker `restart: unless-stopped` (crash / Desktop restart) + an internal reconnect loop with backoff on any socket error (a network blip doesn't need a full container restart) + a stall watchdog that self-`exit(1)`s if no NMEA data has arrived in 60s despite a socket that still looks connected (the failure mode a bare reconnect-on-exception loop would never catch — the gateway went silent without actually dropping the TCP connection) + paho-mqtt's own auto-reconnect (a Mosquitto restart doesn't kill it) + a heartbeat-file Docker `HEALTHCHECK` for `docker ps` visibility.

**Mac-only networking, same as everything else on the interim stack**: reaches the gateways via `host.docker.internal` through the existing `scripts/mac-nmea-relay.sh` bridge (Docker Desktop can't route into `192.168.10.x` directly) — the F8-target `docker-compose.yml` service uses the real `192.168.10.30`/`.31` IPs with `network_mode: host` instead, same parity convention as the rest of the stack.

`nmea_gateways.py`'s `parse_nmea()` is bind-mounted into the daemon's container (not copied/duplicated) so both pipelines parse NMEA sentences with the exact same code — no drift between "current reading" and "gust reading."

`expire_after: 30` on every entity in `nmea_wind_live.yaml` is deliberate: if the daemon dies and every safeguard above somehow fails to recover it, these should go `unavailable`, not freeze on a stale value that reads as a real (mis)reading.

**Restart-safety confirmed live, not just reasoned about (2026-08-15), and a real Docker gotcha found while doing it: `docker kill`/`docker stop` do NOT trigger `restart: unless-stopped`'s auto-restart — Docker tracks that as an administrative stop, deliberately not something to auto-recover from, so don't use `docker kill` as a "does restart-safety work" test (it'll look broken when the policy is actually working as designed).** What `unless-stopped` *does* auto-recover from is the container's own process exiting on its own (unhandled exception, or this daemon's watchdog calling `sys.exit(1)`) -- confirmed two ways: an accidental missing-volume-mount test crash-looped and restarted 5 times in 3 seconds, and a deliberate test (unreachable gateway IPs, `STALE_RESTART_SECONDS=5`) showed the exact designed sequence in the logs -- watchdog fires at 6s ("no NMEA data for 6s > 5s -- exiting"), Docker relaunches it within a second, reconnect loop resumes normally.

## Trending pipeline (InfluxDB / Grafana)

```
HA entities (alternators, engines, NMEA wind/nav, Victron GX, tanks, weather)
  → influxdb: integration (packages/trending_influxdb.yaml)
  → InfluxDB bucket "Sisu", one measurement per entity_id, field "value" (or "state" for text)
  → Grafana (grafana-provisioning/datasources/influxdb.yaml, uid influxdb-sisu)
  → 5 dashboards (grafana-provisioning/dashboards/*.json): Power & Charging,
    Engine & Navigation, Tanks & Watermaker, WeatherAWA, WeatherTWD
```

**Weather is two dashboards, not one** — `sisu-weather.json` (uid `sisu-weather`, title "WeatherAWA") shows wind relative to the bow (apparent wind angle straight off `sensor.nmea_awa`), meant for underway/sailing use. `sisu-weather-twd.json` (uid `sisu-weather-twd`, title "WeatherTWD") shows true (compass-referenced) wind, for anchor-watch use. Both dashboards otherwise share the same wind-speed/heatmap/atmosphere panels verbatim.

**Correction, 2026-08-15 (self-heal):** WeatherTWD originally computed true wind direction as `(heading_magnetic + awa) mod 360` via a Flux join, believing this boat's NMEA feed had no TWD sentence — wrong. Sampling the raw feed found `$YDMWD` (wind direction True + Magnetic, instrument-computed) already on the wire, plus `$YDHDT` (true heading) and MWV reference "T" (`twa_deg`, true wind angle) already being *parsed* by `nmea_gateways.py` but never exposed as entities. Added parsing for MWD + wired up all three: `sensor.nmea_twd` (True Wind Direction, the one WeatherTWD's panels now query directly, no Flux join), `sensor.nmea_heading_true`, `sensor.nmea_twa`. Cross-checked internally consistent against live values (`twd_true_deg == heading_true_deg + twa_deg` to the decimal; `heading_true_deg == heading_mag_deg - magnetic_variation` from the RMC sentence's own variation field). Real TWD is motion-corrected by the instrument regardless of boat speed — WeatherTWD is no longer anchor-only-accurate, the dashboard split remains a UX choice (bow-relative vs compass-true), not a data-quality one.

**Wind rose panels** are Business Charts (`volkovlabs-echarts-panel` 7.2.5, `GF_PLUGINS_PREINSTALL` on the Mac compose file — #35, #36). Grafana 13 core still has no polar panel. Stacked roses join 1-minute means of a direction series + `sensor.nmea_aws` (TWS is not used on the rose) via Flux `union`/`pivot` + `|> group()`, then bin in the charts function: 36 petals at 10°, **length = frequency (% of samples)**, **color = kn band** (2–4.9 / 5–6.9 / 7–9.9 / 10–14.9 / 15–19.9 / 20+), `<2 kn` pulled out as center **Calm: X%**. WeatherAWA keeps one AWA+AWS rose (bow-up). WeatherTWD (#36) has four TWD+AWS roses, N-up: last-5 fading trail (petal length = that minute's AWS, newest brightest), last hour, last 24h, last 7 days. The old XY-Chart compass-dot trail is gone.

**XY Chart panels need `"pluginVersion"` set on the panel object, or they silently crash on load** — found live 2026-08-15 debugging exactly this. Grafana's `xyChartMigrationHandler` runs a legacy-schema migration (`migrateOptions()`, reading `panel.options.seriesMapping`/old-shape `series`) whenever `pluginVersion` is missing/empty, *regardless* of whether the panel's `options` are already written in the current schema (`mapping`/`series` as `XYSeriesConfig[]`) — the migration path then does `oldSeries2.map(...)` on a value that's `undefined` in that case, throwing `Cannot read properties of undefined (reading 'map')` and leaving the panel stuck on "Loading plugin panel..." forever. No error is visible anywhere in Grafana's own UI or server logs — only in the browser's JS console (`page.on("pageerror")` via Playwright is how this got caught; there is no image-renderer plugin installed on this instance, so screenshotting requires driving a real browser, not Grafana's own render API). Fix: give every `xychart` panel `"pluginVersion": "13.1.3"` (or whatever `GET /api/health`'s `version` reports) so the handler takes the `return panel.options` branch instead. Source lives inside the running container at `/usr/share/grafana/public/app/plugins/panel/xychart/` (full `.tsx`/`.ts`, not just minified bundles) — `panelcfg.gen.ts` for the real option schema, `migrations.ts` for this exact trap, `utils.ts`/`scatter.ts` for how "auto" series-mapping and rendering actually work. Reading that source (not guessing from memory) is how the schema — `mapping` not `seriesMapping`, `XYSeriesConfig` shaped `{x:{matcher},y:{matcher},...}` — got nailed down correctly.

**XY Chart axis convention is the boring, expected one**: first numeric field in a frame → chart-horizontal, second → chart-vertical (`x`/`y` are just the Flux field names chosen here, not what determines the axis — order does). Confirmed empirically (screenshot + cropped-and-zoomed axis-label read, since uPlot draws axes on `<canvas>`, not as queryable DOM/SVG text) after a false start swapping `sin`/`cos` based on a misread rotated axis-title glyph in a small screenshot — the original formula (`x = r·sin(bearing)` for east/horizontal, `y = r·cos(bearing)` for north/vertical) was correct from the start.

**WeatherTWD's compass panel** ("True Wind Direction — Compass") plots the last 5 one-minute `sensor.nmea_twd` readings as fixed-radius points on a drawn compass ring (N up), each older reading a fainter shade of the same color — a small comet-trail effect. Still an XY Chart faking polar (not Business Charts): fixed radius means both axes autoscale to the same range, so it renders as a true circle. Keep `pluginVersion` set on this panel (see above).

**Grafana's org-wide home dashboard** is WeatherTWD, set two ways that must be kept in sync: `GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH` in both `docker-compose.mac.yml` and `docker-compose.yml` (the file-provisioned, git-tracked default — survives a container rebuild) and an org preference (`PUT /api/org/preferences {"homeDashboardUID": "sisu-weather-twd"}`, live-only, not git-tracked) which **takes precedence over the env var when both are set** — changing the env var's target dashboard without also re-running the API call leaves the old one showing.

**Multi-measurement Flux joins need an explicit final `|> group()`** before the last `keep`/`sort` — pivoting two unioned streams by `_time` (or any per-row key) leaves the result grouped into one Flux table per row, which the InfluxDB datasource returns as that many separate Grafana frames instead of one. A `timeseries` panel over dozens of 1-row frames technically queries fine but is the wrong shape; caught live 2026-08-15 building the TWD trend panels (57 frames instead of 1) by testing each panel's exact query through Grafana's own `/api/ds/query`, not just raw InfluxDB.

**`include`/`exclude` entity_globs are read once at Core startup, not hot-reloadable** — there's no `influxdb.reload` service (unlike `template:`, which does support `template.reload`). A Core restart is required after editing the include list, same as adding a new package file. Found live 2026-08-15: `sensor.nmea_tws`, `sensor.true_wind_speed_max_6h`, `sensor.sisu_air_temp`, `sensor.sisu_water_temp` were wired in HA but missing from this list since #32 — confirmed absent from the live Influx bucket before the fix, present after + a Core restart.

Single ingress path — do not also enable a Signal K→InfluxDB plugin for the same data (HA already normalizes everything into stable entity_ids). `measurement_attr: entity_id` is set deliberately in the package — HA's influxdb integration defaults that to `unit_of_measurement`, which silently misfiles every unit-bearing sensor into a measurement named after its unit string instead of grouping by entity (see `OPS.md` §7 for the full gotcha writeup). `homeassistant/.env` (generate via `scripts/gen-docker-env.sh` from `secrets.yaml`) feeds the Influx token/org/bucket to both the datasource provisioning YAML and the compose files' Grafana/InfluxDB `environment:` blocks.

**Connection settings live in a UI config entry, not YAML** (HA 2026.9 removed YAML-configured InfluxDB connections) — `trending_influxdb.yaml` only holds `measurement_attr`/`max_retries`/`include`/`exclude` now; host/token/org/bucket were auto-imported on first load, reconfigure via Settings → Devices & services → InfluxDB. See `OPS.md` §7.

## Tides / weather / air+water temp (issue #32)

```
NOAA CO-OPS (api.tidesandcurrents.noaa.gov, free/keyless)
  → python_scripts/tides_noaa.py: nearest-station haversine lookup
    (candidates in USVI/BVI, live GPS from sensor.nmea_latitude/longitude,
    home-position fallback) + hilo predictions in **meters** (units=metric,
    Sisu is a metric boat -- 2026-08-11), 3h on-disk cache
  → sensor.tides_noaa_json → sensor.sisu_tide_station / _next_high / _next_low
    (state is a pre-formatted "HH:MM (in Xh Ym)" string -- 24h local time +
    countdown computed in the template, not a device_class: timestamp;
    height_m kept as an attribute, not a dashboard row)

Open-Meteo Marine API (marine-api.open-meteo.com, free/keyless)
  → python_scripts/weather_openmeteo.py: sea-surface-temp fallback ONLY
    (hourly weather forecast itself is the native weather.forecast_home
    entity, Met.no via default_config: -- already supports forecast_type:
    hourly out of the box, no custom code needed for that part)
  → sensor.weather_open_meteo_json → sensor.sisu_water_temp (NMEA-first)

NMEA 0183 MTA/MTW (nmea_gateways.py parser)
  → sensor.nmea_air_temperature / sensor.nmea_water_temperature (honestly
    `unknown` if the boat's N2K bus doesn't have that sensor fitted --
    water temp confirmed live 2026-08-11, air temp not currently reporting)
  → sensor.sisu_air_temp / sensor.sisu_water_temp prefer these, fall back
    to Met.no / Open-Meteo respectively when unavailable (each exposes a
    `source` attribute saying which it used)
```

All on `ui-lovelace.yaml`'s main "Sisu" board's "Sea & sky" section (depth/temp/wind/tides, all as tile cards — a mixed entities-list card there previously left a visible empty gap next to the tile grids either side of it) + the weather-forecast tile; "Ship zones" nav buttons moved to the bottom of that board (2026-08-11).

**True wind speed** (`sensor.nmea_tws`, MWV sentence with reference "T" — the boat's own instruments compute it, not derived here from AWS+SOG+heading) + a rolling 6h max (`sensor.true_wind_speed_max_6h`, HA's built-in `statistics:` platform, `state_characteristic: value_max`, `max_age: 6h` — reads the source sensor's own recorder history, no extra pipeline). Both confirmed live 2026-08-11 (~9-10kn).

**Barometric pressure + humidity** (`sensor.sisu_barometric_pressure`, `sensor.sisu_humidity`) -- no N2K barometer/hygrometer fitted, so unlike air/water temp there's no NMEA-first fallback pair: both read straight off `weather.forecast_home`'s (Met.no) `pressure`/`humidity` attributes, modeled-only. Confirmed live 2026-08-15 (1016.9 hPa, 82%). If a real barometer ever gets fitted, give it the same NMEA-first pattern as air/water temp above.

No secrets/API keys needed for any of this.

**House bank display bug fixed same pass:** the main board's "House bank" tile/header pointed at `sensor.lab_bench_alts_sim_house_voltage_engine_port` (the alternator sim's local sense point) which reads `unavailable` when the sim isn't running -- displayed as a misleading "0V". Fixed to `sensor.sisu_house_bank` (new, `packages/energy_victron_stubs.yaml`), a combined "13.43 V (92%)" string sourced from the real Victron battery monitor (`sensor.victron_battery_voltage`/`_soc`) -- the actual house bank, not an alternator's sense point. `dashboards/power.yaml` had the same bug, fixed too.

## Spectra pipeline (watermaker)

```
Spectra HTML UI / WS 192.168.0.25:9000  (subprotocol dumb-increment-protocol)
  → spectra_ws.py  status | autorun | stop | cancel_flush
  → command_line sensor.spectra_status_json + shell_command / scripts
  → Water dashboard (/lovelace-water) + optional auto-stop @ 95% (needs tank entities)
```

Operator flow: START → AUTORUN → amount **liters or hours** → OK. Device always FWF after start/stop cycle.

## Other plugins

| Component | State | File |
|-----------|-------|------|
| `signalk-mqtt-sensors` | **enabled** (sample) | `signalk-mqtt-sensors.json` |
| `signalk-mqtt-bridge` | **enabled**, not used for engine data (see engine data note above — REST API used instead) | `signalk-mqtt-bridge.json` |
| Device `mqtt:` on alternator | not used | HA automation bridge only |
| HA MQTT integration | **configured**, interim Mac broker `192.168.0.151:1883` (issue #20, resolved) | `OPS.md` §7 — repoint to F8 `.21` once #6 lands |

Prefer one ingress path to Signal K.

## Non-alternator devices

- **Levels (Marine Board):** HA API; optional MQTT/SK later.  
- **Freezer (LilyGo):** HA API + local AMOLED UI.  
- **Spectra:** WS bridge only — not MQTT.

## When changing the pipeline

1. Change source entity or payload key.  
2. Update `automations.yaml`.  
3. Update `signalk-mqtt-sensors.json` if SK-bound.  
4. Smoke: MQTT Explorer → SK Data Browser.  
5. Spectra: test on device carefully (real pumps).  
