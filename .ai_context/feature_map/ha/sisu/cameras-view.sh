#!/usr/bin/env bash
# ha/sisu/cameras-view — reach + read Sisu › Cameras view. Mode: read.   Usage: cameras-view.sh [--open]
set -uo pipefail
FM_ID=ha/sisu/cameras-view
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace/cameras"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in input_boolean.camera_view_forward input_boolean.camera_view_aft script.forward_camera_reinit script.aft_camera_reinit; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 4 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "4 entities present"; exit 0
