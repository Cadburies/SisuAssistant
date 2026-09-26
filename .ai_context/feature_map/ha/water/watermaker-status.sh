#!/usr/bin/env bash
# ha/water/watermaker-status — reach + read Water › Watermaker status. Mode: read.   Usage: watermaker-status.sh [--open]
set -uo pipefail
FM_ID=ha/water/watermaker-status
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-water/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in binary_sensor.sisu_watermaker_running sensor.sisu_watermaker_autostore binary_sensor.sisu_watermaker_flushing binary_sensor.sisu_watermaker_alarm sensor.sisu_watermaker_product_ppm; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 5 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "5 entities present"; exit 0
