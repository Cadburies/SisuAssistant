#!/usr/bin/env bash
# ha/engine/starboard-engine — reach + read Engine room › Starboard engine. Mode: read.   Usage: starboard-engine.sh [--open]
set -uo pipefail
FM_ID=ha/engine/starboard-engine
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-engine/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in binary_sensor.sisu_engine_starboard_alarm_active sensor.sisu_engine_starboard_alarms sensor.sisu_engine_starboard_rpm sensor.sisu_engine_starboard_coolant sensor.sisu_engine_starboard_oil_pressure sensor.sisu_engine_starboard_hours; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 6 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "6 entities present"; exit 0
