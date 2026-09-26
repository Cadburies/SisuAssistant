#!/usr/bin/env bash
# ha/helm/status — reach + read Helm › Status chips. Mode: read.   Usage: status.sh [--open]
set -uo pipefail
FM_ID=ha/helm/status
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-helm/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.source_wind_active binary_sensor.source_ydwg binary_sensor.source_datahub binary_sensor.sisu_anchor_alarm binary_sensor.sisu_anchor_gps_lost sensor.sisu_anchor_distance binary_sensor.sisu_charging_active; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 7 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "7 entities present"; exit 0
