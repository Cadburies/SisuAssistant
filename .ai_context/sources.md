# Vessel data sources — priority and kernel contract

Non-derivable **policy**. Current entity_ids live in YAML — do not copy them here.  
Issue **#44**. Follow-ons: ingest (#45), HA names (#46), Influx/Grafana views (#47), Signal K (#48).

## Rules (every future issue)

1. **One public name per quantity.** Never `_live` / `_slow` / `_fast`. A consumer that cannot take instrument rate gets a **view** (Influx downsample, HA recorder), not a twin entity.
2. **Per-signal priority** (not “gateway TCP is open”):
   1. **YDWG-02** — law for anything on the N2K/0183 wire. **Liveness = sentences received**, not SYN-ACK (YDWG accepted TCP with zero data 2026-08-15; HA then starved every `nmea_*`). Daemon publishes `sisu/v1/meta/<src>/live` + `age_s` + `error` (HA: `binary_sensor.source_ydwg` / `source_datahub`, dashboard `/lovelace-sources`).
   2. **DataHub** — only if YDWG is mute **or this signal is absent**. Do not use DataHub `$IIMWD` when it is >360°; engines never come from DataHub.
   3. **Other boat box** — Victron GX (house bank), Spectra WS, ESPHome (alts/tanks/freezer). SK engine REST is a *view of YDWG*, not a new source.
   4. **Internet** — NOAA / Met.no / Open-Meteo only if 1–3 cannot provide it.
   5. **Derive** — last resort, and only if the instrument does not already transmit it.
3. **Ingest at instrument rate.** Do not slow the kernel for Grafana.
4. **Grafana (and any heavy reader)** uses a downsample bucket (`Sisu_1m`). Raw (`Sisu_raw`) only for short live windows.
5. **House SoC / bank I** = Victron BMV. ESP `house_v` is *location*. YDWG `Alternator#` / 127508 is *engine/starter*, not house SoC. Freezer "Battery Voltage" is the *freezer feed* (LilyGo ADC or Marine Board U2 bus V).

## Kernel

NMEA half is live (#45 / #51 / #57): local add-on `local_sisu_nmea_ingest` on HA Green (`nmea_wind_daemon.py`) dual-listens YDWG+DataHub, merges per signal, publishes `sisu/v1/<domain>/<qty>` JSON `{value, source, stale_s, value_si}`. Recreate: `./scripts/ha-kernel-mqtt.sh`. Victron / Spectra / ESP / internet still join later.

```
YDWG → DataHub → Victron MQTT → Spectra WS → ESP API → internet
                    ↓  per-signal merge + source= + stale=
              sisu-ingest  (grow nmea_wind_daemon)
                    ↓  MQTT sisu/v1/<domain>/<qty>
         HA mqtt:  ·  Telegraf→Sisu_raw  ·  SK mqtt-sensors
                              ↓ Influx task 1m
                         Sisu_1m → Grafana
```

Do not add Redis/Postgres as a second truth.

## Quantity → source order

Fill left to right; stop at first *live* (data, not just a socket).

| Quantity | 1 YDWG | 2 DataHub | 3 Boat | 4 Net | 5 Derive |
|---|---|---|---|---|---|
| AWS AWA TWS TWA | MWV / VWT | II MWV / DHXDR | — | — | TWS only if no MWV T |
| TWD | **MWD** (sane) | MWD often **broken**; DHXDR rad OK | — | Met.no bearing last | hdg+TWA only if no MWD |
| Heading / SOG / COG / lat lon / depth | YD* | GP/II* | — | — | — |
| Water temp | MTW | MTW / XDR ENV_WATER_T | — | Open-Meteo | — |
| Air temp | **XDR Air / MDA** | **no** | — | Met.no | — |
| Barometer | **XDR Baro / MDA** | **XDR Baro** | — | Met.no | — |
| Humidity | — | — | — | Met.no | — |
| Pitch roll yaw | XDR | pitch/roll only | — | — | — |
| Rudder / ROT / STW / log | RSA ROT VHW VLW | same | — | — | — |
| Engine RPM / coolant / fuel / hours / alt V / boost | **YDRPM / YDXDR / PCDIN** | **no** | SK REST = same YDWG | — | Alt-pulley RPM only if YDWG mute **and** ratio documented |
| House V/I/P/SOC | 127508 ≠ house SoC | no | **Victron BMV** | — | — |
| House V at ER / saloon | — | — | **ESP INA226** (location) | — | — |
| Solar / inverter / AC-DC loads | — | — | **Victron GX** | — | — |
| Fresh tank % | — | — | **ESP 4–20 mA** | — | Spectra page-4 gauge is machine sender — not house tanks |
| Watermaker process | — | — | **Spectra WS** (page-dependent) | — | — |
| Freezer T / local feed V | — | — | **Freezer ESP** (Marine Board; LilyGo interim) | — | — |
| Tides / hourly forecast | — | — | — | NOAA / Met.no | — |
| Sisu Nav forecast / ensemble overlay | — | — | — | Open-Meteo (`cell_selection=sea`) | **View only** — never a twin of instrument TWD/TWS |

Live Y/D sentence inventory (2026-08-15): issue **#44** thread / session plan. Spectra pages: **`homeassistant/docs/SpectraControl.md`**. ESP measured vs derived: table in that same issue / `marine_alternator.yaml` + `waterlevels.yaml` + `freezer.yaml`.

## Consumer contract

| Consumer | Reads | Must not |
|---|---|---|
| sisu-ingest | Y, D, later Victron/Spectra/ESP/net | Two public names for one qty |
| HA | MQTT `sisu/v1/…` → **one** sensor | New `command_line` 15 s twin; new `*_live` |
| Influx raw | Telegraf from MQTT (or HA influx of the **canonical** entity only) | Dual-write slow + live |
| Grafana | `Sisu_1m` for ≥1 h; `Sisu_raw` only short live | Raw 1 Hz over 24 h |
| Signal K | MQTT `sisu/v1` via `signalk-mqtt-sensors` (`value_si` is SI) | Second DataHub TCP for kernel-owned wind/nav; YDWG TCP stays for AIS / oil |
| Lovelace | Canonical HA sensors | Mix `nmea_twd` and `nmea_twd_live` on one board |
| Sisu Nav | SK WS `environment.wind.*` / `navigation.*` (same kernel); Open-Meteo as **overlay only** | New `_live` twins; MQTT client in the browser |
| Polar dataset (Influx, #132) | `sensor.sisu_polar_*` while engines-off **and** SOG/STW ≥ 1.5 kn | Motoring, YDWG-down (`unknown`), or dock/anchor swimming — see `packages/polar_logging.yaml` |

## Transitional

`sensor.nmea_*` is the one HA name (mqtt `sisu/v1`, #46). Do not reintroduce `_live` / 15s command_line twins.
