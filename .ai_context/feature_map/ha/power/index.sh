#!/usr/bin/env bash
# ha/power — reach + read Power › Dashboard. Mode: read.   Usage: index.sh [--open]
set -uo pipefail
FM_ID=ha/power
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-power/system"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.sisu_house_bank; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 1 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "1 entities present"; exit 0
