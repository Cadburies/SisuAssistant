# Sisu NMEA ingest (local add-on)

Dual-listen YDWG + DataHub → MQTT `sisu/v1`. Replaces the ad-hoc `sisu-nmea-ingest` container so Supervisor stays supported (#57).

**Source of the daemon:** `homeassistant/nmea_wind_daemon/nmea_wind_daemon.py` — `./scripts/ha-kernel-mqtt.sh` copies it here on Green before build. Parser is `/config/python_scripts/nmea_gateways.py` via `homeassistant_config` map.

**Bring-up:** `./scripts/ha-kernel-mqtt.sh` (also sets `core_mosquitto` `logins:`). Bump `version` in `config.yaml` after Dockerfile/run.py changes so the store offers Update; daemon-only changes are a rebuild after the copy.
