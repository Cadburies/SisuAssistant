#!/usr/bin/env bash
# ha/engine/house-bank — reach + read Engine room › House bank (BMS). Mode: read.   Usage: house-bank.sh [--open]
set -uo pipefail
FM_ID=ha/engine/house-bank
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-engine/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.victron_battery_soc binary_sensor.victron_bms_alarm sensor.victron_battery_voltage sensor.victron_battery_current sensor.victron_battery_power sensor.victron_battery_consumed_ah; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 6 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "6 entities present"; exit 0
