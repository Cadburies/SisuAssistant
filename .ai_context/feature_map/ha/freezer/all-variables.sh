#!/usr/bin/env bash
# ha/freezer/all-variables — reach + read Freezer › All variables. Mode: read.   Usage: all-variables.sh [--open]
set -uo pipefail
FM_ID=ha/freezer/all-variables
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-freezer/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.aft_cockpit_sisu_freezer_freezer_temperature climate.aft_cockpit_sisu_freezer_freezer_thermostat select.freezer_debug_level text_sensor.freezer_reset_reason; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 4 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "4 entities present"; exit 0
