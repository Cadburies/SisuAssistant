#!/usr/bin/env bash
# ha/sisu/sea-sky — reach + read Sisu › Sea & sky. Mode: read.   Usage: sea-sky.sh [--open]
set -uo pipefail
FM_ID=ha/sisu/sea-sky
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace/default_view"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.nmea_depth sensor.sisu_tide_station sensor.sisu_air_temp sensor.sisu_water_temp sensor.nmea_aws sensor.apparent_wind_speed_max_6h sensor.sisu_tide_next_high sensor.sisu_tide_next_low sensor.sisu_sunrise sensor.sisu_sunset sensor.sisu_moonrise sensor.sisu_moonset; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 12 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "12 entities present"; exit 0
