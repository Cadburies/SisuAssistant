#!/usr/bin/env bash
# ha/engine/firmware-diagnostics — reach + read Engine room › Firmware diagnostics. Mode: read.   Usage: firmware-diagnostics.sh [--open]
set -uo pipefail
FM_ID=ha/engine/firmware-diagnostics
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-engine/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in select.alternatorport_debug_level text_sensor.alternatorport_reset_reason sensor.alternatorport_loop_time select.alternatorstarboard_debug_level text_sensor.alternatorstarboard_reset_reason sensor.alternatorstarboard_loop_time; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 6 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "6 entities present"; exit 0
