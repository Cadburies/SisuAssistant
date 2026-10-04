# Sisu Marine Automation System

Marine automation for sailing vessel **Sisu**: dual alternators, tanks, freezer, helm instruments, Home Assistant, Signal K, and MQTT.

**Feature guide:** every screen, control and device, with how to reach it — [project wiki](https://github.com/Cadburies/SisuAssistant/wiki) (generated from [`.ai_context/feature_map/`](.ai_context/feature_map/)). Security reports: [`SECURITY.md`](SECURITY.md).

## Platform roles

| Function                                   | Hardware                                         |
| ------------------------------------------ | ------------------------------------------------ |
| Alternators Port / Starboard               | **Sisu Marine Board** (ESP32-S3-WROOM-2-N32R16V) |
| Tank / water levels                        | **Sisu Marine Board**                            |
| Freezer / fridge                           | **Marine Board** (LilyGo S3 AMOLED until fitted) |
| Home Assistant + MQTT kernel (`sisu/v1`)   | **HA Green** (Ethernet)                          |
| Signal K · Grafana / Influx · backups      | **TerraMaster F8** (Ethernet, Docker) |
| Chart / AIS / windex (Sisu Nav)            | Docker on F8 — `http://192.168.0.21:8088`, Follow me on `https://192.168.0.21:8443` (#188) |
| Helm engine / fuel gauges (planned)        | **Veratron OL43** (NMEA 2000, high-nits)         |

| Document                                  | Content                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| **[`INSTALLATION.md`](INSTALLATION.md)**  | **Wiring & commission manual** — Marine Board, alts, levels, freezer, Spectra, BMS, safety    |
| **[`OPS.md`](OPS.md)**                    | **Agent-first setup** — what only you do vs agent; SSH; ESPHome; Marine Board bench          |
| **[`NETWORK.md`](NETWORK.md)**            | Wi‑Fi 7 SSIDs, routing so **Sisu** can open HA and see IoT, F8 stack, secrets, helm, trending |
| **[`Technical Specifications.md`](Technical%20Specifications.md)** | System firmware roles & safety                                                      |
| **[`MarineBoard/`](MarineBoard/)** folder | KiCad hardware project (schematic, PCB, BOM) — **[`Technical Specs.md`](MarineBoard/Technical%20Specs.md)** is the PCB/GPIO/connector reference; **[`Documentation/`](MarineBoard/Documentation/)** has schematic-section PNG exports |
| **[`.ai_context/naming.md`](.ai_context/naming.md)** | Entity / Signal K / N2K names                                                     |
| **[`sisu-nav/`](sisu-nav/)** | Chart + AIS + windex + weather + isochrone routing — `http://192.168.0.21:8088`. Install: **[`sisu-nav/INSTALLATION.md`](sisu-nav/INSTALLATION.md)** · Usage: **[`sisu-nav/USER_GUIDE.md`](sisu-nav/USER_GUIDE.md)** · Dev: **[`sisu-nav/DEVELOPER.md`](sisu-nav/DEVELOPER.md)** · issues label **[sisu-nav](https://github.com/Cadburies/SisuAssistant/issues?q=label%3Asisu-nav)** |
| **[Wiki](https://github.com/Cadburies/SisuAssistant/wiki)** · [`.ai_context/feature_map/`](.ai_context/feature_map/) | **Feature guide** — one page per screen/control/device (how to reach it, what it does, what to expect); regenerated automatically from the feature map on every push. Format: [`DESIGN.md`](.ai_context/feature_map/DESIGN.md) |

## Network (summary)

**Router:** **GL.iNet GL-BE9300 (Flint 3)** Wi‑Fi 7

| SSID           | Subnet          | Clients                                      |
| -------------- | --------------- | -------------------------------------------- |
| **Sisu**       | 192.168.0.0/24  | Wi‑Fi 7 phones/laptops; HA Green; TNAS `.21` |
| **Sisu-IoT**   | 192.168.10.0/24 | All ESP32s (2.4 GHz)                         |
| **Sisu-Guest** | guest           | Isolated                                     |

| Host                               | IP                                  |
| ---------------------------------- | ----------------------------------- |
| HA Green                           | **192.168.0.20**                    |
| TNAS F8                            | **192.168.0.21**                    |
| Alt Port / Stbd / Levels / Freezer / Saloon display | **192.168.10.41 / .42 / .43 / .44 / .45** |

Phone stays on **Sisu** → `http://192.168.0.20:8123`; router **must** allow HA → `192.168.10.0/24`.

Full GL-BE9300 actions: **`NETWORK.md` §3–§4**. Agent ops: **`OPS.md`**.

## What runs where

```text
                 ┌──────────── Mac (source of truth: edit · commit · build · push) ────────────┐
                 │  ha-deploy-config.sh ─► HA Green      f8-deploy.sh ─► F8      esphome ─► ESPs │
                 └──────────────────────────────────────────────────────────────────────────────┘

 Sisu-IoT 192.168.10.x                     Sisu LAN 192.168.0.x
 ┌──────────────────────────┐  ESPHome   ┌───────────────────────────────┐ MQTT sisu/v1 ┌─────────────────────────┐
 │ Marine Boards .41–.44    │─── API ───►│ HA Green .20                  │─────────────►│ F8 .21 (Docker)         │
 │ Saloon display .45       │            │ HA Core · Mosquitto (kernel)  │ Influx write │ Signal K · InfluxDB     │
 │ YDWG .30 · DataHub .31   │─── NMEA ──►│ NMEA ingest · ESPHome builder │─────────────►│ Grafana · Sisu Nav · …  │
 │ Victron Color Control .32│─── MQTT ──►│ packages / python_scripts     │              └─────────────────────────┘
 └──────────────────────────┘            └───────────────────────────────┘
        N2K backbone: Raymarine instruments · engines · (Veratron OL43 planned) ─► YDWG / DataHub
```

Safety-relevant control (alternator field, hard cut-offs, freezer thermostat) runs **locally on each ESP32** — HA, MQTT and the F8 can all be down without losing it.

### Mac — source of truth and build machine

Every file HA Green and the F8 run from starts here (`CLAUDE.md` rule 12): edit → commit → push. `./scripts/stack-drift.sh` shows any box that has drifted.

| What | How |
|---|---|
| Config + source for both boxes | this repo; push with `./scripts/ha-deploy-config.sh <files>` (HA Green) and `./scripts/f8-deploy.sh` (F8) |
| ESP32 firmware | `esphome config` / `compile` / first flash over USB-C; later OTA over Wi‑Fi |
| Marine Board hardware | KiCad project in [`MarineBoard/`](MarineBoard/); fab package via `MarineBoard/fab_package.py` |
| Rollback only | `homeassistant/docker-compose.mac.yml` (the F8 stack, run locally) |

### HA Green — Home Assistant OS, `192.168.0.20`

| Runs | Does | Source |
|---|---|---|
| **Home Assistant Core** `:8123` | Dashboards, automations, all ESP32 devices (ESPHome API) | [`homeassistant/configuration.yaml`](homeassistant/configuration.yaml), [`dashboards/`](homeassistant/dashboards/), [`ui-lovelace.yaml`](homeassistant/ui-lovelace.yaml) |
| **Mosquitto** add-on `:1883` | The MQTT **kernel** (`sisu/v1`) everything else subscribes to | `core_mosquitto`; logins via `./scripts/ha-kernel-mqtt.sh` |
| **Sisu NMEA ingest** add-on | Reads YDWG (primary) + DataHub (fail-over) NMEA 0183 over TCP → MQTT | [`addons/sisu_nmea_ingest/`](homeassistant/addons/sisu_nmea_ingest/), [`nmea_wind_daemon/`](homeassistant/nmea_wind_daemon/) |
| **ESPHome Device Builder** add-on | ESPHome dashboard on the boat (builds from the pushed `/config/esphome`) | [`homeassistant/esphome/`](homeassistant/esphome/) |
| **Advanced SSH** add-on | Deploy/ops access for the Mac scripts | `scripts/ha-ssh.sh` |
| MQTT republish | HA → `sisu/v1` topics for Signal K | [`automations.yaml`](homeassistant/automations.yaml) |
| Victron GX bridge | Battery SoC/V/I, solar, loads from the Color Control's own MQTT | [`packages/victron_gx.yaml`](homeassistant/packages/victron_gx.yaml), [`python_scripts/victron_gx.py`](homeassistant/python_scripts/victron_gx.py) |
| Spectra bridge | Watermaker state/control over the Spectra WebSocket | [`packages/spectra_newport.yaml`](homeassistant/packages/spectra_newport.yaml), [`python_scripts/spectra_ws.py`](homeassistant/python_scripts/spectra_ws.py) |
| Internet sources | Open-Meteo weather, NOAA tides | [`python_scripts/`](homeassistant/python_scripts/) |
| Cameras | SV3C forward / aft on the LAN (`192.168.0.33` / `.34`) — snapshots, dinghy watch | [`packages/sv3c_*_camera.yaml`](homeassistant/packages/) |
| Source health, anchor watch, polar logging, trending | Liveness per source; anchor alarm; wind/speed logging; history → Influx on the F8 | [`packages/`](homeassistant/packages/) |

### TerraMaster F8 — Docker stack, `192.168.0.21`

All services use host networking; defined in [`homeassistant/docker-compose.yml`](homeassistant/docker-compose.yml).

| Service | Port | Does |
|---|---|---|
| **signalk-server** | `3000` | Signal K; subscribes to the Green MQTT kernel; KIP / Freeboard apps built in |
| **influxdb** (v2) | `8086` | Long-term history (bucket `Sisu`), written by HA |
| **grafana** | `3001` | Graphs from Influx ([`grafana-provisioning/`](homeassistant/grafana-provisioning/)) |
| **sisu-nav-api** | `8088`, `8443` | Sisu Nav chart / AIS / weather / routing ([`sisu-nav/`](sisu-nav/)). `:8443` is the HTTPS page Follow me needs |
| **tileserver-gl** | `8087` | Local chart tiles for Sisu Nav |
| **mqtt-explorer** | `4000` | Browse the MQTT kernel (points at Green `:1883`) |

### Marine Boards — ESP32-S3, Sisu-IoT (ESPHome)

Shared base: [`packages/marine_board_base.yaml`](homeassistant/esphome/packages/marine_board_base.yaml) (Wi‑Fi, API, INA226 bus, buzzer, RGB status LED).

| Board | IP | Firmware | Runs locally |
|---|---|---|---|
| Alternator Port | `.41` | [`alternatorport.yaml`](homeassistant/esphome/alternatorport.yaml) | Field PWM PID, Victron-style stages, **hard cut-offs** 250 A / 14.4 V / 125 °C, fault latch, shadow mode ([`marine_alternator.yaml`](homeassistant/esphome/packages/marine_alternator.yaml)) |
| Alternator Starboard | `.42` | [`alternatorstarboard.yaml`](homeassistant/esphome/alternatorstarboard.yaml) | Same; the two share a house-current budget (300 A combined, #16/#62) |
| Water Levels | `.43` | [`waterlevels.yaml`](homeassistant/esphome/waterlevels.yaml) | Two 4–20 mA tank senders, house voltage at the saloon |
| Freezer | `.44` | [`freezer_marineboard.yaml`](homeassistant/esphome/freezer_marineboard.yaml) | Thermostat + compressor relay; LilyGo S3 AMOLED [`freezer.yaml`](homeassistant/esphome/freezer.yaml) until the board is fitted |

### Other devices

| Device | Where | Role |
|---|---|---|
| Saloon display (Waveshare 4.3B ESP32-S3) | Sisu-IoT `.45` | Guest touch display ([`saloon_display.yaml`](homeassistant/esphome/saloon_display.yaml)) |
| Anchor tension (LilyGo, planned) | Sisu-IoT `.46` | Load cell ([`anchortension.yaml`](homeassistant/esphome/anchortension.yaml), #34) |
| Yacht Devices YDWG-02 | Sisu-IoT `.30` | N2K → NMEA 0183 TCP (primary instrument source) |
| PredictWind DataHub | Sisu-IoT `.31` | N2K → NMEA 0183 TCP (fail-over) |
| Victron Color Control GX | Sisu-IoT `.32` | Batteries, solar, inverter over local MQTT |
| Spectra Newport 400c | LAN `.25` | Watermaker controller (WebSocket) |
| N2K backbone | — | Raymarine instruments, engines; Veratron OL43 helm display planned |

Data flow and naming in detail: [`.ai_context/data_flow.md`](.ai_context/data_flow.md), [`NETWORK.md`](NETWORK.md) §7, [`OPS.md`](OPS.md) §7. `docker-compose.mac.yml` is rollback only.

## Features (short)

- Alternator PID, Victron-style float/absorption, hard house voltage ceiling **14.4 V**
- House voltage at **each Marine Board** (wiring drop / corrosion compare)
- Fresh water levels (4–20 mA)
- Freezer moving to a Marine Board (`freezer_marineboard.yaml`); LilyGo AMOLED `freezer.yaml` until fitted
- MQTT → Signal K; long-term graphs via **Grafana + InfluxDB** on F8

## Secrets

**One** `homeassistant/secrets.yaml` for the boat (gitignored, never committed):

- `wifi_ssid` / `wifi_password` → **Sisu-IoT** only (ESPs)
- `mqtt_broker` → **HA Green `192.168.0.20`** (kernel); F8 `.21` is SK / Grafana / Influx / Sisu Nav
- HA Green needs no Wi‑Fi secrets

**[`homeassistant/secrets.yaml.example`](homeassistant/secrets.yaml.example)** is the committed template — copy it to `secrets.yaml` and fill in real values. Every key has a comment explaining what it is and exactly where to get or generate it (router UI, HA's own onboarding wizard, a keygen one-liner, a device's first-run setup screen, etc.), so implementing this on your own boat doesn't require reverse-engineering anything. Kept in sync automatically — `./scripts/scan_secrets.sh` fails the commit if the two files' keys ever drift apart.

See `NETWORK.md` §6 / `.ai_context/secrets.md` for the full policy.

## Install (high level)

0. After cloning: `git config core.hooksPath .githooks` (secret guards on commit/push — `scan_secrets.sh` insists on it once `secrets.yaml` exists).
1. Wire **HA Green** and **F8** to router Ethernet; configure SSIDs/routing per `NETWORK.md`.
2. Complete **human one-time steps** in **`OPS.md` §4** (SSH protection mode, ESPHome app, router rules).
3. Agent deploys config from the Mac (source of truth): `./scripts/ha-deploy-config.sh <files>` + `./scripts/stack-drift.sh`.
4. Marine Board GPIO mapping (lab, not a vessel role): **`bench_marine_board.yaml`**. First vessel flash is **shadow** (`INSTALLATION.md` §6.4).
5. F8 Docker (`homeassistant/docker-compose.yml` via `./scripts/f8-deploy.sh`): Signal K, InfluxDB, Grafana, **Sisu Nav** at `http://192.168.0.21:8088`. MQTT kernel stays on Green.
6. Flash production ESPs on Sisu-IoT (`alternator*`, `waterlevels`, `freezer`, `saloon_display`).
7. From a client on **Sisu**, open HA and confirm entities online.
8. Future Helm MFD: Veratron OL 43 Smart Marine Monitoring TFT MFD Display NMEA 2000 N2K Touchscreen

## Safety

Controls live marine electrics. Bench-test before engine-room OTA. Helm gauges must remain trustworthy on **N2K** even if Wi‑Fi fails.

## License

[Apache License 2.0](LICENSE) — covers the original work in this repository (configuration, firmware YAML, scripts, Sisu Nav, documentation, and the Marine Board design files authored for this project).

Third-party material vendored here keeps its **own** license and is not relicensed: Espressif KiCad libraries (`MarineBoard/Lib/*/com_github_espressif_kicad-libraries/`), the impartGUI KiCad plugin (`MarineBoard/Lib/plugins/com_github_Steffen-W_impartGUI/`), JLCPCB library metadata (`MarineBoard/Lib/JLCPCB_*`), and EasyEDA/LCSC-derived footprints, symbols and 3D models (`MarineBoard/Lib/EasyEDA.*`, `MarineBoard/Lib/Models/`). npm dependencies are under their own licenses.
