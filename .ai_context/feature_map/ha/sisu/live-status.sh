#!/usr/bin/env bash
# ha/sisu/live-status — reach + read Sisu › Live status. Mode: read.   Usage: live-status.sh [--open]
set -uo pipefail
FM_ID=ha/sisu/live-status
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace/default_view"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.sisu_house_bank binary_sensor.sisu_charging_active sensor.sisu_alternators_combined_current binary_sensor.sisu_alternatorport_online binary_sensor.sisu_alternatorstarboard_online sensor.victron_solar_power binary_sensor.sisu_watermaker_running sensor.sisu_freshwater_level sensor.sisu_blackwater_level sensor.sisu_fuel_level binary_sensor.sisu_genset_running binary_sensor.sisu_anchor_alarm; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 12 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "12 entities present"; exit 0
