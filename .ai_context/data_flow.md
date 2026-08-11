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

## Trending pipeline (InfluxDB / Grafana)

```
HA entities (alternators, engines, NMEA wind/nav, Victron GX, tanks)
  → influxdb: integration (packages/trending_influxdb.yaml)
  → InfluxDB bucket "Sisu", one measurement per entity_id, field "value" (or "state" for text)
  → Grafana (grafana-provisioning/datasources/influxdb.yaml, uid influxdb-sisu)
  → 3 dashboards (grafana-provisioning/dashboards/*.json): Power & Charging,
    Engine & Navigation, Tanks & Watermaker
```

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

All on `ui-lovelace.yaml`'s main "Sisu" board — "Sea & sky" (depth/temp) and "Tides" sections + the weather-forecast tile, "Ship zones" nav buttons moved to the bottom of that board (2026-08-11). No secrets/API keys needed for any of this.

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
