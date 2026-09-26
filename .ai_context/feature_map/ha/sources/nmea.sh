#!/usr/bin/env bash
# ha/sources/nmea — reach + read Sources › NMEA gateways. Mode: read.   Usage: nmea.sh [--open]
set -uo pipefail
FM_ID=ha/sources/nmea
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-sources/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in binary_sensor.source_ydwg binary_sensor.source_datahub sensor.source_wind_active sensor.source_ydwg_age sensor.source_datahub_age sensor.source_ydwg_error sensor.source_datahub_error; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 7 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "7 entities present"; exit 0
