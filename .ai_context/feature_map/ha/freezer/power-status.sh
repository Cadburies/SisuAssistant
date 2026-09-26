#!/usr/bin/env bash
# ha/freezer/power-status — reach + read Freezer › Power & status. Mode: read.   Usage: power-status.sh [--open]
set -uo pipefail
FM_ID=ha/freezer/power-status
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-freezer/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.aft_cockpit_sisu_freezer_battery_voltage switch.aft_cockpit_sisu_freezer_freezer_compressor binary_sensor.aft_cockpit_sisu_freezer_battery_low binary_sensor.aft_cockpit_sisu_freezer_ds18b20_status binary_sensor.source_freezer; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 5 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "5 entities present"; exit 0
