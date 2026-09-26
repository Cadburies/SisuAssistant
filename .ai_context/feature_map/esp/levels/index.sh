#!/usr/bin/env bash
# esp/levels — reach Water Levels › Marine Board. Mode: read.   Usage: index.sh [--open]
set -uo pipefail
FM_ID=esp/levels
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.10.43/"

need_tcp 192.168.10.43 80 "ESP 192.168.10.43"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.10.43/")
echo "  http://192.168.10.43/ → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
