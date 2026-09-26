#!/usr/bin/env bash
# ha/trending/placeholders — reach + read Trending › Placeholder vessel entities. Mode: read.   Usage: placeholders.sh [--open]
set -uo pipefail
FM_ID=ha/trending/placeholders
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace/default_view"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.sisu_genset_status sensor.sisu_fuel_level; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 2 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "2 entities present"; exit 0
