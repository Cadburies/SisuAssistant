# Sisu Marine Automation System

Marine automation for sailing vessel **Sisu**: dual alternators, tanks, freezer, helm instruments, Home Assistant, Signal K, and MQTT.

## Platform roles

| Function                                   | Hardware                                         |
| ------------------------------------------ | ------------------------------------------------ |
| Alternators Port / Starboard               | **Sisu Marine Board** (ESP32-S3-WROOM-2-N32R16V) |
| Tank / water levels                        | **Sisu Marine Board**                            |
| Freezer / fridge                           | **LilyGo S3 AMOLED** (for now)                   |
| Home Assistant                             | **HA Green** (Ethernet)                          |
| MQTT · Signal K · Grafana/Influx · backups | **TerraMaster F8 SSD Plus** (Ethernet, Docker)   |
| Helm engine / fuel gauges (planned)        | **Veratron OL43** (NMEA 2000, high-nits)         |

| Document                                  | Content                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| **`INSTALLATION.md`**                     | **Wiring & commission manual** — Marine Board, alts, levels, freezer, Spectra, BMS, safety    |
| **`OPS.md`**                              | **Agent-first setup** — what only you do vs agent; SSH; ESPHome; bench T8-S3                  |
| **`NETWORK.md`**                          | Wi‑Fi 7 SSIDs, routing so **Sisu** can open HA and see IoT, F8 stack, secrets, helm, trending |
| **`Technical Specifications.md`**         | System firmware roles & safety                                                                |
| **`MarineBoardSpecs/Technical Specs.md`** | PCB / GPIO                                                                                    |
| **`.ai_context/naming.md`**               | Entity / Signal K / N2K names                                                                 |

## Network (summary)

**Router:** **GL.iNet GL-BE9300 (Flint 3)** Wi‑Fi 7

| SSID           | Subnet          | Clients                                      |
| -------------- | --------------- | -------------------------------------------- |
| **Sisu**       | 192.168.0.0/24  | Wi‑Fi 7 phones/laptops; HA Green; TNAS `.21` |
| **Sisu-IoT**   | 192.168.10.0/24 | All ESP32s (2.4 GHz)                         |
| **Sisu_Guest** | guest           | Isolated                                     |

| Host                               | IP                                  |
| ---------------------------------- | ----------------------------------- |
| HA Green                           | **192.168.0.20**                    |
| TNAS F8                            | **192.168.0.21**                    |
| Alt Port / Stbd / Levels / Freezer | **192.168.10.41 / .42 / .43 / .44** |
| Lab LilyGo T8-S3 (bench only)      | **192.168.10.49**                   |

Phone stays on **Sisu** → `http://192.168.0.20:8123`; router **must** allow HA → `192.168.10.0/24`.

Full GL-BE9300 actions: **`NETWORK.md` §3–§4**. Agent ops: **`OPS.md`**.

## Software stack

```text
ESP32 (Sisu-IoT) ──API──► HA Green ──MQTT──► F8: Mosquitto → Signal K
                              │
                              └──Influx──► F8: Grafana (trends)

N2K backbone ──► Raymarine · Veratron OL43 · (Yacht Devices today)
```

## Features (short)

- Alternator PID, Victron-style float/absorption, hard house voltage ceiling **14.4 V**
- House voltage at **each Marine Board** (wiring drop / corrosion compare)
- Fresh water levels (4–20 mA)
- Freezer on LilyGo AMOLED
- MQTT → Signal K; long-term graphs via **Grafana + InfluxDB** on F8

## Secrets

**One** `homeassistant/secrets.yaml` for the boat:

- `wifi_ssid` / `wifi_password` → **Sisu-IoT** only (ESPs)
- `mqtt_broker` → **F8 IP**
- HA Green needs no Wi‑Fi secrets

See `NETWORK.md` §6.

## Install (high level)

1. Wire **HA Green** (+ later **F8**) to router Ethernet; configure SSIDs/routing per `NETWORK.md`.
2. Complete **human one-time steps** in **`OPS.md` §4** (SSH protection mode, ESPHome app, router rules).
3. Agent deploys config: `./scripts/ha-deploy-config.sh`.
4. Lab without Marine Boards: flash **`bench_t8s3.yaml`** on LilyGo T8-S3.
5. Docker on F8 when ready: Mosquitto, Signal K, InfluxDB, Grafana; point HA MQTT at F8.
6. Flash production ESPs on Sisu-IoT (`alternator*`, `waterlevels`, `freezer`).
7. From a client on **Sisu**, open HA and confirm entities online.
8. Future Helm MFD: Veratron OL 43 Smart Marine Monitoring TFT MFD Display NMEA 2000 N2K Touchscreen

## Safety

Controls live marine electrics. Bench-test before engine-room OTA. Helm gauges must remain trustworthy on **N2K** even if Wi‑Fi fails.

## License

Apache License 2.0 where applicable.
