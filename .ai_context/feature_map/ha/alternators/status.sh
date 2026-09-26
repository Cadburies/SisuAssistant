#!/usr/bin/env bash
# ha/alternators/status — reach + read Alternators › Board status. Mode: read.   Usage: status.sh [--open]
set -uo pipefail
FM_ID=ha/alternators/status
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-alternators/overview"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in binary_sensor.sisu_alternatorport_online binary_sensor.sisu_alternatorstarboard_online sensor.alternatorport_house_voltage_engine_port sensor.alternatorstarboard_house_voltage_engine_starboard binary_sensor.sisu_charging_active; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 5 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "5 entities present"; exit 0
