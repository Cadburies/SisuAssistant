#!/usr/bin/env bash
# Inject the real MQTT broker credential (already in homeassistant/secrets.yaml,
# same broker HA's own MQTT integration uses) into the two Signal K MQTT plugin
# config files on disk, WITHOUT ever writing it into what git tracks.
#
# Why this exists (issue #74): signalk-mqtt-bridge and signalk-mqtt-sensors
# have no !secret-style indirection — their schemas only accept a literal
# password (bridge: embedded in mqttBrokerAddress; sensors: mqtt_password).
# The committed copies of both JSON files stay permanently credential-free;
# this script is what makes the *live* files on disk (same bind-mounted path
# the SK container reads) actually able to authenticate.
#
# Run this once after a fresh checkout / whenever the SK container is
# recreated, then restart/reload the SK container so it picks up the change.
# `git checkout -- <path>` (or a fresh `git pull`) restores the credential-
# free committed baseline — do that before editing either file's actual
# structure (e.g. adding a new sensor topic mapping) so you don't risk
# committing the live credential by accident. scan_secrets.sh also checks
# these two paths against what's actually staged, not the injected disk
# content, so a normal `git add`/commit of unrelated changes won't trip on
# this script having been run.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SECRETS="homeassistant/secrets.yaml"
BRIDGE="homeassistant/signalk/plugin-config-data/signalk-mqtt-bridge.json"
SENSORS="homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json"

[[ -f "$SECRETS" ]] || { echo "missing $SECRETS — nothing to inject" >&2; exit 1; }
[[ -f "$BRIDGE" && -f "$SENSORS" ]] || { echo "missing SK plugin-config-data files" >&2; exit 1; }

read_secret() {
  awk -F': *' -v k="$1" '$1==k {gsub(/["'"'"']/, "", $2); print $2; exit}' "$SECRETS"
}
BROKER="$(read_secret mqtt_broker)"
USER="$(read_secret mqtt_username)"
PASS="$(read_secret mqtt_password)"

[[ -n "$BROKER" && -n "$USER" && -n "$PASS" ]] || {
  echo "mqtt_broker / mqtt_username / mqtt_password missing from $SECRETS" >&2
  exit 1
}

python3 - "$BRIDGE" "$SENSORS" "$BROKER" "$USER" "$PASS" <<'PYEOF'
import json, sys

bridge_path, sensors_path, broker, user, password = sys.argv[1:6]

with open(bridge_path) as f:
    bridge = json.load(f)
bridge["configuration"]["mqttBrokerAddress"] = f"mqtt://{user}:{password}@{broker}:1883"
with open(bridge_path, "w") as f:
    json.dump(bridge, f, indent=2)
    f.write("\n")

with open(sensors_path) as f:
    sensors = json.load(f)
sensors["configuration"]["mqtt_password"] = password
with open(sensors_path, "w") as f:
    json.dump(sensors, f, indent=2)
    f.write("\n")
PYEOF

echo "Injected local MQTT credentials into signalk-mqtt-bridge.json / signalk-mqtt-sensors.json."
echo "Restart/reload the SK container to pick it up. Do NOT commit these two files while the"
echo "real credential is in place — 'git checkout -- $BRIDGE $SENSORS' restores the safe baseline."
