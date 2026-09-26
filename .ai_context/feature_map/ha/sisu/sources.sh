#!/usr/bin/env bash
# ha/sisu/sources — reach + read Sisu › Sources. Mode: read.   Usage: sources.sh [--open]
set -uo pipefail
FM_ID=ha/sisu/sources
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace/default_view"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in binary_sensor.source_ydwg binary_sensor.source_datahub binary_sensor.source_victron binary_sensor.source_spectra binary_sensor.source_alternators binary_sensor.source_levels binary_sensor.source_freezer binary_sensor.source_noaa_tides sensor.source_wind_active; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 9 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "9 entities present"; exit 0
