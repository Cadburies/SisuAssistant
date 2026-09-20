# Sisu Marine Automation System

Marine automation for sailing vessel **Sisu**: dual alternators, tanks, freezer, helm instruments, Home Assistant, Signal K, and MQTT.

## Platform roles

| Function                                   | Hardware                                         |
| ------------------------------------------ | ------------------------------------------------ |
| Alternators Port / Starboard               | **Sisu Marine Board** (ESP32-S3-WROOM-2-N32R16V) |
| Tank / water levels                        | **Sisu Marine Board**                            |
| Freezer / fridge                           | **LilyGo S3 AMOLED** (for now)                   |
| Home Assistant + MQTT kernel (`sisu/v1`)   | **HA Green** (Ethernet)                          |
| Signal K · Grafana / Influx · backups      | **TerraMaster F8** (Ethernet, Docker) |
| Chart / AIS / windex (Sisu Nav)            | Docker on F8 — `http://192.168.0.21:8088` (#76 floor; weather/routing #77–#80) |
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

## Software stack

```text
ESP32 (Sisu-IoT) ──API──► HA Green ──Mosquitto sisu/v1──► Signal K (F8 .21)
                              │
                              └──Influx──► Grafana (F8 .21)

N2K backbone ──► Raymarine · Veratron OL43 · (Yacht Devices today)
```

Kernel Mosquitto + NMEA ingest run on **HA Green** (`OPS.md` §7, #51). Signal K / Grafana / Influx / Sisu Nav run on the **F8** (`192.168.0.21`, #6). `docker-compose.mac.yml` is rollback only.

## Features (short)

- Alternator PID, Victron-style float/absorption, hard house voltage ceiling **14.4 V**
- House voltage at **each Marine Board** (wiring drop / corrosion compare)
- Fresh water levels (4–20 mA)
- Freezer on LilyGo AMOLED
- MQTT → Signal K; long-term graphs via **Grafana + InfluxDB** on F8

## Secrets

**One** `homeassistant/secrets.yaml` for the boat (gitignored, never committed):

- `wifi_ssid` / `wifi_password` → **Sisu-IoT** only (ESPs)
- `mqtt_broker` → **HA Green `192.168.0.20`** (kernel); F8 `.21` is SK / Grafana / Influx / Sisu Nav
- HA Green needs no Wi‑Fi secrets

**[`homeassistant/secrets.yaml.example`](homeassistant/secrets.yaml.example)** is the committed template — copy it to `secrets.yaml` and fill in real values. Every key has a comment explaining what it is and exactly where to get or generate it (router UI, HA's own onboarding wizard, a keygen one-liner, a device's first-run setup screen, etc.), so implementing this on your own boat doesn't require reverse-engineering anything. Kept in sync automatically — `./scripts/scan_secrets.sh` fails the commit if the two files' keys ever drift apart.

See `NETWORK.md` §6 / `.ai_context/secrets.md` for the full policy.

## Install (high level)

1. Wire **HA Green** and **F8** to router Ethernet; configure SSIDs/routing per `NETWORK.md`.
2. Complete **human one-time steps** in **`OPS.md` §4** (SSH protection mode, ESPHome app, router rules).
3. Agent deploys config: `./scripts/ha-deploy-config.sh`.
4. Marine Board GPIO mapping (lab, not a vessel role): **`bench_marine_board.yaml`**. First vessel flash is **shadow** (`INSTALLATION.md` §6.4).
5. F8 Docker (`homeassistant/docker-compose.yml` via `./scripts/f8-deploy.sh`): Signal K, InfluxDB, Grafana, **Sisu Nav** at `http://192.168.0.21:8088`. MQTT kernel stays on Green.
6. Flash production ESPs on Sisu-IoT (`alternator*`, `waterlevels`, `freezer`, `saloon_display`).
7. From a client on **Sisu**, open HA and confirm entities online.
8. Future Helm MFD: Veratron OL 43 Smart Marine Monitoring TFT MFD Display NMEA 2000 N2K Touchscreen

## Safety

Controls live marine electrics. Bench-test before engine-room OTA. Helm gauges must remain trustworthy on **N2K** even if Wi‑Fi fails.

## License

Apache License 2.0 where applicable.
