#!/usr/bin/env bash
# ha/engine/firmware-diagnostics — reach + read Engine room › Firmware diagnostics. Mode: read.   Usage: firmware-diagnostics.sh [--open]
set -uo pipefail
FM_ID=ha/engine/firmware-diagnostics
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-engine/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"
g=$(ha_state binary_sensor.sisu_alternatorport_online); [[ "$g" == "on" ]] || { echo "SKIP: Port board offline (#11) (binary_sensor.sisu_alternatorport_online=$g)"; fm_result "$FM_ID" skip "Port board offline (#11)"; exit 2; }

bad=0
for e in select.engine_port_alternator_port_debug_level sensor.engine_port_alternator_port_reset_reason sensor.engine_port_alternator_port_loop_time select.engine_starboard_alternator_starboard_debug_level sensor.engine_starboard_alternator_starboard_reset_reason sensor.engine_starboard_alternator_starboard_loop_time; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 6 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "6 entities present"; exit 0
