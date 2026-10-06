#!/usr/bin/env bash
# ha/alternators/starboard — reach + read Alternators › Starboard gauges & setpoints. Mode: read.   Usage: starboard.sh [--open]
set -uo pipefail
FM_ID=ha/alternators/starboard
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-alternators/overview"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"
g=$(ha_state binary_sensor.sisu_alternatorstarboard_online); [[ "$g" == "on" ]] || { echo "SKIP: Starboard board offline (#11) (binary_sensor.sisu_alternatorstarboard_online=$g)"; fm_result "$FM_ID" skip "Starboard board offline (#11)"; exit 2; }

bad=0
for e in sensor.alternatorstarboard_alternator_current_starboard number.alternatorstarboard_alternator_current_setpoint_starboard sensor.alternatorstarboard_house_voltage_engine_starboard number.alternatorstarboard_house_absorption_voltage_starboard number.alternatorstarboard_house_float_voltage_starboard sensor.alternatorstarboard_alternator_temperature_starboard number.alternatorstarboard_alternator_temperature_setpoint_starboard binary_sensor.alternatorstarboard_alternator_enable_starboard sensor.alternatorstarboard_alternator_charge_stage_starboard sensor.alternatorstarboard_alternator_field_duty_starboard binary_sensor.engine_starboard_alternator_starboard_alternator_fault_latched_starboard; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 11 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "11 entities present"; exit 0
