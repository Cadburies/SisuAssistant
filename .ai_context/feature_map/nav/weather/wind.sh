#!/usr/bin/env bash
# nav/weather/wind — reach Sisu Nav › Weather wind & discrepancies. Mode: read.   Usage: wind.sh [--open]
set -uo pipefail
FM_ID=nav/weather/wind
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:8088"

need_tcp 192.168.0.21 8088 "Sisu Nav"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.21:8088/api/weather/models")
echo "  http://192.168.0.21:8088/api/weather/models → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
