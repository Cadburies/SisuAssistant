#!/usr/bin/env bash
# Copy mqtt_username / mqtt_password from secrets.yaml into the live
# Signal K plugin JSON (bind-mounted). Does not commit. Use --strip
# before git add of those files.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/homeassistant/secrets.yaml"
SENSORS="$ROOT/homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json"
BRIDGE="$ROOT/homeassistant/signalk/plugin-config-data/signalk-mqtt-bridge.json"
STRIP=0
[[ "${1:-}" == "--strip" ]] && STRIP=1

python3 - "$SECRETS" "$SENSORS" "$BRIDGE" "$STRIP" <<'PY'
import json, re, sys
secrets_p, sensors_p, bridge_p, strip = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1"

def secret(key):
    text = open(secrets_p, encoding="utf-8").read()
    m = re.search(rf'^{re.escape(key)}:\s*["\']?([^"\'#\n]*)', text, re.M)
    return (m.group(1).strip() if m else "")

user = secret("mqtt_username") or "sisu"
pw = secret("mqtt_password")
broker = secret("mqtt_broker") or "192.168.0.20"

sensors = json.load(open(sensors_p))
cfg = sensors.setdefault("configuration", {})
cfg["mqtt_server"] = f"mqtt://{broker}:1883"
cfg["mqtt_username"] = user
if strip or not pw:
    cfg.pop("mqtt_password", None)
else:
    cfg["mqtt_password"] = pw
json.dump(sensors, open(sensors_p, "w"), indent=2)
open(sensors_p, "a").write("\n")

bridge = json.load(open(bridge_p))
bcfg = bridge.setdefault("configuration", {})
if strip or not pw:
    bcfg["mqttBrokerAddress"] = f"mqtt://{broker}:1883"
else:
    bcfg["mqttBrokerAddress"] = f"mqtt://{user}:{pw}@{broker}:1883"
json.dump(bridge, open(bridge_p, "w"), indent=2)
open(bridge_p, "a").write("\n")
print("mqtt creds", "stripped" if strip else "applied", "user="+user)
PY
