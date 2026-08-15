#!/usr/bin/env bash
# Start kernel Mosquitto + NMEA ingest on HA Green (#51).
#
# Not Supervisor core_mosquitto: that add-on loads go-auth.so and only
# accepts Home Assistant users. allow_anonymous in /share/mosquitto does
# not override the plugin (live: "Connection Refused: not authorised").
# SK + ingest are LAN clients without HA credentials; we will not put a
# broker password in git-tracked signalk plugin JSON.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH="$REPO_ROOT/scripts/ha-ssh.sh"
PASS=$(awk -F': *' '$1=="ha_ssh_password" {gsub(/["'\''"]/, "", $2); print $2; exit}' \
  "$REPO_ROOT/homeassistant/secrets.yaml" 2>/dev/null || true)
PASS=${PASS:-***REMOVED***}

# Host path for HA /config (SSH addon sees it as /config → /homeassistant).
HA_HOST=/mnt/data/supervisor/homeassistant

sudo_sh() {
  # bash -c, not -lc: a login shell on HAOS prints the hassio CLI banner
  # and is the wrong environment for docker run.
  "$SSH" "echo '$PASS' | sudo -S bash -c $(printf '%q' "$1")"
}

"$REPO_ROOT/scripts/ha-deploy-config.sh" \
  homeassistant/python_scripts/nmea_gateways.py \
  homeassistant/nmea_wind_daemon/nmea_wind_daemon.py

sudo_sh 'mkdir -p /config/mosquitto/config /config/nmea_wind_daemon /config/python_scripts'
sudo_sh 'printf "%s\n" "listener 1883" "allow_anonymous true" > /config/mosquitto/config/mosquitto.conf'

sudo_sh "
set -e
HA=${HA_HOST}
docker rm -f sisu-mosquitto >/dev/null 2>&1 || true
docker run -d --name sisu-mosquitto --restart unless-stopped --network host \
  -v \${HA}/mosquitto/config:/mosquitto/config \
  eclipse-mosquitto:latest
docker rm -f sisu-nmea-ingest >/dev/null 2>&1 || true
docker run -d --name sisu-nmea-ingest --restart unless-stopped --network host \
  -v \${HA}/python_scripts/nmea_gateways.py:/app/nmea_gateways.py:ro \
  -v \${HA}/nmea_wind_daemon/nmea_wind_daemon.py:/app/nmea_wind_daemon.py:ro \
  -e TZ=America/Tortola \
  -e YDWG_HOST=192.168.10.30 \
  -e YDWG_PORT=1456 \
  -e DATAHUB_HOST=192.168.10.31 \
  -e DATAHUB_PORT=11102 \
  -e MQTT_HOST=127.0.0.1 \
  -e MQTT_PORT=1883 \
  -e MQTT_KERNEL_PREFIX=sisu/v1 \
  python:3.12-slim \
  sh -c 'pip install -q paho-mqtt==2.1.0 && python -u /app/nmea_wind_daemon.py'
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'sisu-mosquitto|sisu-nmea-ingest'
"
echo "kernel mqtt + ingest started on HA Green"
