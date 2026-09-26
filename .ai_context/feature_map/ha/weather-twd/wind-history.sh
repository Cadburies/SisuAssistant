#!/usr/bin/env bash
# ha/weather-twd/wind-history — reach + read Weather TWD › Wind history. Mode: read.   Usage: wind-history.sh [--open]
set -uo pipefail
FM_ID=ha/weather-twd/wind-history
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-weather-anchor/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.nmea_aws sensor.nmea_tws sensor.nmea_twd; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 3 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "3 entities present"; exit 0
