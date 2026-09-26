#!/usr/bin/env bash
# ha/helm/route — reach + read the Helm › Route card. Read-only.  Usage: route.sh [--open]
set -uo pipefail
FM_ID=ha/helm/route
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-helm/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

status=$(ha_state sensor.sisu_route_status)
echo "Active route: $status"
for e in eta time_to_go distance next_point next_point_distance next_point_eta; do
  echo "  $e: $(ha_state sensor.sisu_route_$e)"
done

case "$status" in
  "<missing>"|"<error>") fm_result "$FM_ID" unexpected "route sensor $status"; exit 1 ;;
  *)                     fm_result "$FM_ID" ok "status=$status"; exit 0 ;;
esac
