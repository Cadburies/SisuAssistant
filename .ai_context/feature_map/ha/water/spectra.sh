#!/usr/bin/env bash
# ha/water/spectra — reach + read Water › Spectra pressures & quality. Mode: read.   Usage: spectra.sh [--open]
set -uo pipefail
FM_ID=ha/water/spectra
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-water/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.sisu_watermaker_feed_pressure sensor.sisu_watermaker_boost_pressure sensor.sisu_watermaker_filter_condition sensor.sisu_watermaker_product_ppm; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 4 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "4 entities present"; exit 0
