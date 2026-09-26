#!/usr/bin/env bash
# ha/water/autorun — reach + read Water › Autorun & watermaker controls. Mode: read.   Usage: autorun.sh [--open]
set -uo pipefail
FM_ID=ha/water/autorun
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-water/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.sisu_watermaker_recommended_liters input_select.spectra_autorun_unit input_number.spectra_autorun_amount input_boolean.spectra_auto_stop_on_full button.sisu_watermaker_autorun_smart button.sisu_watermaker_autorun button.sisu_watermaker_stop; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 7 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "7 entities present"; exit 0
