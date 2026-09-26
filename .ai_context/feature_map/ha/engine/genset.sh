#!/usr/bin/env bash
# ha/engine/genset — reach + read Engine room › Genset (future). Mode: read.   Usage: genset.sh [--open]
set -uo pipefail
FM_ID=ha/engine/genset
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-engine/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in binary_sensor.sisu_genset_running sensor.sisu_genset_status switch.sisu_genset_start switch.sisu_genset_stop switch.sisu_genset_preheat; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 5 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "5 entities present"; exit 0
