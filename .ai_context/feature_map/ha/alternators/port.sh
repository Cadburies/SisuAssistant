#!/usr/bin/env bash
# ha/alternators/port — reach + read Alternators › Port gauges & setpoints. Mode: read.   Usage: port.sh [--open]
set -uo pipefail
FM_ID=ha/alternators/port
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-alternators/overview"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"
g=$(ha_state binary_sensor.sisu_alternatorport_online); [[ "$g" == "on" ]] || { echo "SKIP: Port board offline (#11) (binary_sensor.sisu_alternatorport_online=$g)"; fm_result "$FM_ID" skip "Port board offline (#11)"; exit 2; }

bad=0
for e in sensor.alternatorport_alternator_current_port number.alternatorport_alternator_current_setpoint_port sensor.alternatorport_house_voltage_engine_port number.alternatorport_house_absorption_voltage_port number.alternatorport_house_float_voltage_port sensor.alternatorport_alternator_temperature_port number.alternatorport_alternator_temperature_setpoint_port binary_sensor.alternatorport_alternator_enable_port sensor.alternatorport_alternator_charge_stage_port sensor.alternatorport_alternator_field_duty_port binary_sensor.alternatorport_alternator_fault_latched_port; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 11 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "11 entities present"; exit 0
