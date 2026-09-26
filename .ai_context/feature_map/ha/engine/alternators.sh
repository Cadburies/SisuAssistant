#!/usr/bin/env bash
# ha/engine/alternators — reach + read Engine room › Alternators summary. Mode: read.   Usage: alternators.sh [--open]
set -uo pipefail
FM_ID=ha/engine/alternators
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-engine/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in binary_sensor.sisu_alternatorport_online binary_sensor.sisu_alternatorstarboard_online sensor.alternatorport_alternator_current_port sensor.alternatorstarboard_alternator_current_starboard; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 4 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "4 entities present"; exit 0
