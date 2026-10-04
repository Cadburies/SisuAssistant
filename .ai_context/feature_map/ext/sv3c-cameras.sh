#!/usr/bin/env bash
# ext/sv3c-cameras — reach SV3C PoE cameras (device). Mode: read.   Usage: sv3c-cameras.sh [--open]
set -uo pipefail
FM_ID=ext/sv3c-cameras
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
URL=""

need_tcp 192.168.0.33 80 "forward camera"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.33/")
echo "  forward http://192.168.0.33/ → HTTP $code"
aft=$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 "http://192.168.0.34/" || true)
echo "  aft http://192.168.0.34/ → HTTP ${aft:-down}"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
