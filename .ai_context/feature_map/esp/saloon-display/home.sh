#!/usr/bin/env bash
# esp/saloon-display/home — reach Saloon display › Home page. Mode: read.   Usage: home.sh [--open]
set -uo pipefail
FM_ID=esp/saloon-display/home
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.10.45/"

need_tcp 192.168.10.45 80 "ESP 192.168.10.45"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.10.45/")
echo "  http://192.168.10.45/ → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
