#!/usr/bin/env bash
# ha/helm/nmea-instruments — reach + read Helm › NMEA instruments. Mode: read.   Usage: nmea-instruments.sh [--open]
set -uo pipefail
FM_ID=ha/helm/nmea-instruments
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-helm/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.nmea_sog sensor.nmea_cog sensor.nmea_depth sensor.nmea_aws sensor.nmea_awa sensor.nmea_heading_magnetic binary_sensor.nmea_gateway_has_fix; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 7 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "7 entities present"; exit 0
