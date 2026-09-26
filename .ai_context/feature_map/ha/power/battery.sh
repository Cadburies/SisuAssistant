#!/usr/bin/env bash
# ha/power/battery — reach + read Power › House battery gauges. Mode: read.   Usage: battery.sh [--open]
set -uo pipefail
FM_ID=ha/power/battery
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-power/system"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.victron_battery_soc sensor.victron_battery_voltage sensor.victron_battery_current; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 3 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "3 entities present"; exit 0
