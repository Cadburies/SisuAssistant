#!/usr/bin/env bash
# f8/signalk/freeboard — reach Signal K › Freeboard chart plotter. Mode: read.   Usage: freeboard.sh [--open]
set -uo pipefail
FM_ID=f8/signalk/freeboard
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:3000/@signalk/freeboard-sk/"

need_tcp 192.168.0.21 3000 "Signal K"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.21:3000/@signalk/freeboard-sk/")
echo "  http://192.168.0.21:3000/@signalk/freeboard-sk/ → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
