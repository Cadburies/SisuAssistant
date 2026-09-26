#!/usr/bin/env bash
# ha/engine/port-engine — reach + read Engine room › Port engine. Mode: read.   Usage: port-engine.sh [--open]
set -uo pipefail
FM_ID=ha/engine/port-engine
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-engine/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in binary_sensor.sisu_engine_port_alarm_active sensor.sisu_engine_port_alarms sensor.sisu_engine_port_rpm sensor.sisu_engine_port_coolant sensor.sisu_engine_port_oil_pressure sensor.sisu_engine_port_hours; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 6 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "6 entities present"; exit 0
