#!/usr/bin/env bash
# ha/power/solar — reach + read Power › Solar (3× MPPT). Mode: read.   Usage: solar.sh [--open]
set -uo pipefail
FM_ID=ha/power/solar
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-power/system"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.victron_solar_roof_fwd_power sensor.victron_solar_roof_mid_power sensor.victron_solar_aft_power sensor.victron_solar_power sensor.victron_solar_yield_today sensor.victron_solar_state; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 6 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "6 entities present"; exit 0
