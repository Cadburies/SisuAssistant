#!/usr/bin/env bash
# ha/water/levels-diagnostics — reach + read Water › Levels board diagnostics. Mode: read.   Usage: levels-diagnostics.sh [--open]
set -uo pipefail
FM_ID=ha/water/levels-diagnostics
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-water/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in select.waterlevels_debug_level text_sensor.waterlevels_reset_reason sensor.waterlevels_loop_time; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 3 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "3 entities present"; exit 0
