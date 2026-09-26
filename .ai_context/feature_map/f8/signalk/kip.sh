#!/usr/bin/env bash
# f8/signalk/kip — reach Signal K › KIP instrument panel. Mode: read.   Usage: kip.sh [--open]
set -uo pipefail
FM_ID=f8/signalk/kip
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:3000/@mxtommy/kip/"

need_tcp 192.168.0.21 3000 "Signal K"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.21:3000/@mxtommy/kip/")
echo "  http://192.168.0.21:3000/@mxtommy/kip/ → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
