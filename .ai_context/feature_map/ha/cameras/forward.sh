#!/usr/bin/env bash
# ha/cameras/forward — reach + read Cameras › Forward camera (SV3C). Mode: read.   Usage: forward.sh [--open]
set -uo pipefail
FM_ID=ha/cameras/forward
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace/default_view"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in input_select.forward_camera_mode camera.forward_camera_mainstream sensor.forward_camera_last_snapshot_summary button.forward_camera_reboot script.forward_camera_reinit automation.forward_camera_motion_trigger_photo_burst; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 6 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "6 entities present"; exit 0
