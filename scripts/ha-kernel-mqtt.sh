#!/usr/bin/env bash
# Kernel MQTT on HA Green = official core_mosquitto + logins: + local ingest add-on (#51 / #57).
# Credentials: homeassistant/secrets.yaml mqtt_username / mqtt_password.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH="$REPO_ROOT/scripts/ha-ssh.sh"
PASS=$(awk -F': *' '$1=="ha_ssh_password" {gsub(/["'\''"]/, "", $2); print $2; exit}' \
  "$REPO_ROOT/homeassistant/secrets.yaml" 2>/dev/null || true)
: "${PASS:?ha_ssh_password missing in homeassistant/secrets.yaml}"
ADDON_SLUG=local_sisu_nmea_ingest

sudo_sh() {
  "$SSH" "echo '$PASS' | sudo -S bash -c $(printf '%q' "$1")"
}

"$REPO_ROOT/scripts/ha-deploy-config.sh" \
  homeassistant/python_scripts/nmea_gateways.py \
  homeassistant/nmea_wind_daemon/nmea_wind_daemon.py \
  homeassistant/secrets.yaml

# Stage add-on tree + current daemon (Supervisor builds from /addons/<slug>/ only).
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp "$REPO_ROOT/homeassistant/addons/sisu_nmea_ingest/"* "$STAGE/"
cp "$REPO_ROOT/homeassistant/nmea_wind_daemon/nmea_wind_daemon.py" "$STAGE/nmea_wind_daemon.py"
tar -C "$STAGE" -cf - . | "$SSH" "cat > /tmp/sisu-nmea-addon.tar"
sudo_sh 'mkdir -p /addons/sisu_nmea_ingest && tar -C /addons/sisu_nmea_ingest -xf /tmp/sisu-nmea-addon.tar && rm -f /tmp/sisu-nmea-addon.tar && chmod -R a+rX /addons/sisu_nmea_ingest && ls /addons/sisu_nmea_ingest'

# Build Supervisor option blobs on Green (password never echoed).
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
json.dump({
    "options": {
        "ydwg_host": "192.168.10.30",
        "ydwg_port": 1456,
        "datahub_host": "192.168.10.31",
        "datahub_port": 11102,
        "mqtt_host": "127.0.0.1",
        "mqtt_port": 1883,
        "mqtt_username": user,
        "mqtt_password": pw,
        "mqtt_kernel_prefix": "sisu/v1",
    }
}, open("/tmp/ingest-addon-options.json", "w"))
print("options written for mqtt user", user)
PY'

sudo_sh '
set -e
docker rm -f sisu-mosquitto >/dev/null 2>&1 || true
docker exec hassio_cli ha addons install core_mosquitto >/dev/null 2>&1 || true
docker cp /tmp/mosquitto-options.json hassio_cli:/tmp/mosquitto-options.json
docker exec hassio_cli sh -c "curl -sS -X POST -H \"Authorization: Bearer \$SUPERVISOR_TOKEN\" -H \"Content-Type: application/json\" -d @/tmp/mosquitto-options.json http://supervisor/addons/core_mosquitto/options"
echo
docker exec hassio_cli ha addons start core_mosquitto >/dev/null 2>&1 || docker exec hassio_cli ha addons restart core_mosquitto >/dev/null
docker exec hassio_cli ha addons info core_mosquitto | grep -E "state:|version:"
'

sudo_sh '
set -e
docker cp /tmp/ingest-addon-options.json hassio_cli:/tmp/ingest-addon-options.json
docker exec hassio_cli ha store reload >/dev/null
# Wait until Local apps lists the slug (store reload is async).
for i in 1 2 3 4 5 6 7 8; do
  if docker exec hassio_cli ha addons info '"$ADDON_SLUG"' >/dev/null 2>&1; then
    break
  fi
  if docker exec hassio_cli ha store --raw-json 2>/dev/null | grep -q '"$ADDON_SLUG"'; then
    break
  fi
  sleep 2
done
if docker exec hassio_cli ha addons info '"$ADDON_SLUG"' >/dev/null 2>&1; then
  docker exec hassio_cli ha addons rebuild '"$ADDON_SLUG"'
else
  docker exec hassio_cli ha addons install '"$ADDON_SLUG"'
fi
docker exec hassio_cli sh -c "curl -sS -X POST -H \"Authorization: Bearer \$SUPERVISOR_TOKEN\" -H \"Content-Type: application/json\" -d @/tmp/ingest-addon-options.json http://supervisor/addons/'"$ADDON_SLUG"'/options"
echo
docker exec hassio_cli ha addons start '"$ADDON_SLUG"' >/dev/null 2>&1 || docker exec hassio_cli ha addons restart '"$ADDON_SLUG"'
docker exec hassio_cli ha addons info '"$ADDON_SLUG"' | grep -E "state:|version:|name:"
# Drop the rogue docker-run container only after the add-on is up.
docker rm -f sisu-nmea-ingest >/dev/null 2>&1 || true
# Leftover unofficial images trip Supervisor "unsupported software".
docker rmi eclipse-mosquitto:latest signalk/signalk-server:latest 2>/dev/null || true
rm -f /tmp/ingest-addon-options.json /tmp/mosquitto-options.json
docker ps --format "{{.Names}} {{.Status}}" | grep -E "sisu_nmea|sisu-nmea|core_mosquitto" || true
'

"$REPO_ROOT/scripts/apply-mqtt-creds.sh"
echo "kernel: core_mosquitto + logins + local add-on $ADDON_SLUG"
