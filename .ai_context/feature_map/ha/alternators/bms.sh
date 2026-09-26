#!/usr/bin/env bash
# ha/alternators/bms — reach + read Alternators › BMS / pack. Mode: read.   Usage: bms.sh [--open]
set -uo pipefail
FM_ID=ha/alternators/bms
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-alternators/overview"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.victron_bms_state sensor.victron_battery_soc binary_sensor.victron_bms_alarm sensor.victron_bms_alarm_detail; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 4 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "4 entities present"; exit 0
