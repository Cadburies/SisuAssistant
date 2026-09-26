#!/usr/bin/env bash
# ha/helm/anchor-watch — reach + read Helm › Anchor watch. Mode: read.   Usage: anchor-watch.sh [--open]
set -uo pipefail
FM_ID=ha/helm/anchor-watch
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-helm/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in switch.sisu_anchor_alarm_enable button.sisu_anchor_set_here number.sisu_anchor_radius sensor.sisu_anchor_suggested_radius button.sisu_anchor_apply_suggested_radius number.sisu_anchor_breach_delay sensor.sisu_anchor_distance device_tracker.sisu_boat_position; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 8 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "8 entities present"; exit 0
