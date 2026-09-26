#!/usr/bin/env bash
# ha/power/flows — reach + read Power › Flows view. Mode: read.   Usage: flows.sh [--open]
set -uo pipefail
FM_ID=ha/power/flows
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-power/flows"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.alternatorport_house_voltage_engine_port sensor.sisu_alternators_combined_current; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 2 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "2 entities present"; exit 0
