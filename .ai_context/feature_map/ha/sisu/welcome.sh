#!/usr/bin/env bash
# ha/sisu/welcome — reach + read Sisu › Header & forecast. Mode: read.   Usage: welcome.sh [--open]
set -uo pipefail
FM_ID=ha/sisu/welcome
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace/default_view"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.sisu_house_bank sensor.sisu_alternators_charge_summary weather.forecast_home; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 3 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "3 entities present"; exit 0
