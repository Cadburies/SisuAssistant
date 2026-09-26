#!/usr/bin/env bash
# ha/sisu/cameras — reach + read Sisu › Cameras (mode & snapshots). Mode: read.   Usage: cameras.sh [--open]
set -uo pipefail
FM_ID=ha/sisu/cameras
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace/default_view"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in input_select.aft_camera_mode camera.aft_camera_latest_snapshot sensor.aft_camera_last_snapshot_summary input_select.forward_camera_mode camera.forward_camera_latest_snapshot sensor.forward_camera_last_snapshot_summary; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 6 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "6 entities present"; exit 0
