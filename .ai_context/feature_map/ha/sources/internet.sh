#!/usr/bin/env bash
# ha/sources/internet — reach + read Sources › Internet fallback. Mode: read.   Usage: internet.sh [--open]
set -uo pipefail
FM_ID=ha/sources/internet
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-sources/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in binary_sensor.source_noaa_tides binary_sensor.source_met_no binary_sensor.source_open_meteo; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 3 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "3 entities present"; exit 0
