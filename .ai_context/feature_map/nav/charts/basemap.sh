#!/usr/bin/env bash
# nav/charts/basemap — reach Sisu Nav › Charts list. Mode: read.   Usage: basemap.sh [--open]
set -uo pipefail
FM_ID=nav/charts/basemap
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:8088"

need_tcp 192.168.0.21 8088 "Sisu Nav"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.21:8088/api/tilesets")
echo "  http://192.168.0.21:8088/api/tilesets → HTTP $code"
check=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.21:8088/api/chartbundle/export-check")
echo "  http://192.168.0.21:8088/api/chartbundle/export-check → HTTP $check"
case "$code" in 2*|3*|401) ;; *) fm_result "$FM_ID" unexpected "tilesets HTTP $code"; exit 1 ;; esac
case "$check" in 200) fm_result "$FM_ID" ok "tilesets HTTP $code, export-check HTTP $check"; exit 0 ;;
                *) fm_result "$FM_ID" unexpected "export-check HTTP $check"; exit 1 ;; esac
