#!/usr/bin/env bash
# Kernel MQTT on HA Green = official core_mosquitto + logins: (#51).
# Credentials: homeassistant/secrets.yaml mqtt_username / mqtt_password.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH="$REPO_ROOT/scripts/ha-ssh.sh"
PASS=$(awk -F': *' '$1=="ha_ssh_password" {gsub(/["'\''"]/, "", $2); print $2; exit}' \
  "$REPO_ROOT/homeassistant/secrets.yaml" 2>/dev/null || true)
PASS=${PASS:-***REMOVED***}
HA_HOST=/mnt/data/supervisor/homeassistant

sudo_sh() {
  "$SSH" "echo '$PASS' | sudo -S bash -c $(printf '%q' "$1")"
}

"$REPO_ROOT/scripts/ha-deploy-config.sh" \
  homeassistant/python_scripts/nmea_gateways.py \
  homeassistant/nmea_wind_daemon/nmea_wind_daemon.py \
  homeassistant/secrets.yaml

# Build Supervisor options + ingest env-file on Green (password never echoed).
sudo_sh 'python3 - <<'"'"'PY'"'"'
import json, re
text = open("/config/secrets.yaml", encoding="utf-8").read()
def secret(key):
    m = re.search(rf"^{re.escape(key)}:\s*[\"'\'']?([^\"'\''#\n]*)", text, re.M)
    return (m.group(1).strip() if m else "")
user = secret("mqtt_username") or "sisu"
pw = secret("mqtt_password")
if not pw:
    raise SystemExit("mqtt_password empty in /config/secrets.yaml")
json.dump({
    "options": {
        "certfile": "fullchain.pem",
        "keyfile": "privkey.pem",
        "customize": {"active": False, "folder": "mosquitto"},
        "logins": [{"username": user, "password": pw}],
        "require_certificate": False,
        "log_dest": [],
        "log_type": [],
    }
}, open("/tmp/mosquitto-options.json", "w"))
open("/tmp/nmea-ingest.env", "w").write(
    f"MQTT_USER={user}\nMQTT_PASSWORD={pw}\n"
)
print("options+env written for mqtt user", user)
PY'

sudo_sh '
set -e
docker rm -f sisu-mosquitto >/dev/null 2>&1 || true
ha addons install core_mosquitto >/dev/null 2>&1 || true
docker cp /tmp/mosquitto-options.json hassio_cli:/tmp/mosquitto-options.json
docker exec hassio_cli sh -c "curl -sS -X POST -H \"Authorization: Bearer \$SUPERVISOR_TOKEN\" -H \"Content-Type: application/json\" -d @/tmp/mosquitto-options.json http://supervisor/addons/core_mosquitto/options"
echo
ha addons start core_mosquitto >/dev/null 2>&1 || ha addons restart core_mosquitto >/dev/null
ha addons info core_mosquitto | grep -E "state:|version:"
'

sudo_sh "
set -e
HA=${HA_HOST}
docker rm -f sisu-nmea-ingest >/dev/null 2>&1 || true
docker run -d --name sisu-nmea-ingest --restart unless-stopped --network host \
  --env-file /tmp/nmea-ingest.env \
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
rm -f /tmp/nmea-ingest.env /tmp/mosquitto-options.json
docker ps --format '{{.Names}} {{.Status}}' | grep sisu-nmea-ingest
"

"$REPO_ROOT/scripts/apply-mqtt-creds.sh"
echo "kernel: core_mosquitto + logins + ingest"
