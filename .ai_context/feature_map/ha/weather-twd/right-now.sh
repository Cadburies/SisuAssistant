#!/usr/bin/env bash
# ha/weather-twd/right-now — reach + read Weather TWD › Right now. Mode: read.   Usage: right-now.sh [--open]
set -uo pipefail
FM_ID=ha/weather-twd/right-now
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-weather-anchor/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.nmea_aws sensor.nmea_tws sensor.true_wind_speed_max_6h sensor.nmea_twd; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 4 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "4 entities present"; exit 0
