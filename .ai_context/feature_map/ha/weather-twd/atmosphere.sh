#!/usr/bin/env bash
# ha/weather-twd/atmosphere — reach + read Weather TWD › Atmosphere. Mode: read.   Usage: atmosphere.sh [--open]
set -uo pipefail
FM_ID=ha/weather-twd/atmosphere
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-weather-anchor/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.sisu_air_temp sensor.sisu_water_temp sensor.sisu_barometric_pressure sensor.sisu_humidity; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 4 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "4 entities present"; exit 0
