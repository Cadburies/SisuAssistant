#!/usr/bin/env bash
# ha/power/loads — reach + read Power › Alternators, loads & BMS. Mode: read.   Usage: loads.sh [--open]
set -uo pipefail
FM_ID=ha/power/loads
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-power/system"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.sisu_alternators_charge_summary sensor.victron_grid_power sensor.victron_inverter_power sensor.victron_ac_loads sensor.victron_dc_loads sensor.victron_bms_state binary_sensor.victron_bms_alarm; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 7 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "7 entities present"; exit 0
