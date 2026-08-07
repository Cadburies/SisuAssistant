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
| `signalk-mqtt-bridge` | **disabled** | `signalk-mqtt-bridge.json` |
| Device `mqtt:` on alternator | not used | HA automation bridge only |
| HA MQTT integration | **not yet** on Green (as of session) | Install → `.21` (O14) |

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
