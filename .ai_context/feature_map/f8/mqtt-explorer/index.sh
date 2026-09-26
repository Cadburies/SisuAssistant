#!/usr/bin/env bash
# f8/mqtt-explorer — reach MQTT Explorer. Mode: read.   Usage: index.sh [--open]
set -uo pipefail
FM_ID=f8/mqtt-explorer
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:4000"

need_tcp 192.168.0.21 4000 "MQTT Explorer"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.21:4000/")
echo "  http://192.168.0.21:4000/ → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
