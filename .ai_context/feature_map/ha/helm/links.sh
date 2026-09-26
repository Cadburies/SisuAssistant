#!/usr/bin/env bash
# ha/helm/links — reach + read Helm › Onboard systems links. Mode: read.   Usage: links.sh [--open]
set -uo pipefail
FM_ID=ha/helm/links
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace-helm/main"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in sensor.source_wind_active; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 1 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "1 entities present"; exit 0
