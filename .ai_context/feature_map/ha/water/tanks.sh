#!/usr/bin/env bash
# ha/water/tanks — reach + read Water › Tanks. Mode: read.   Usage: tanks.sh [--open]
set -uo pipefail
FM_ID=ha/water/tanks
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-water/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.sisu_freshwater_fwd_level sensor.sisu_freshwater_aft_level sensor.sisu_freshwater_level sensor.sisu_blackwater_level sensor.sisu_fuel_level binary_sensor.sisu_freshwater_tanks_present; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 6 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "6 entities present"; exit 0
