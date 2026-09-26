#!/usr/bin/env bash
# ha/sources/boat-instruments — reach + read Sources › Boat instruments. Mode: read.   Usage: boat-instruments.sh [--open]
set -uo pipefail
FM_ID=ha/sources/boat-instruments
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-sources/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in binary_sensor.source_victron binary_sensor.source_spectra binary_sensor.source_alternators binary_sensor.source_levels binary_sensor.source_freezer binary_sensor.source_freezer_error; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 6 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "6 entities present"; exit 0
