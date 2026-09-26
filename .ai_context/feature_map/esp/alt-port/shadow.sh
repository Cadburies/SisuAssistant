#!/usr/bin/env bash
# esp/alt-port/shadow — reach Alternator Port › Shadow measure-only. Mode: read.   Usage: shadow.sh [--open]
set -uo pipefail
FM_ID=esp/alt-port/shadow
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.10.41/"

need_tcp 192.168.10.41 80 "ESP 192.168.10.41"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.10.41/")
echo "  http://192.168.10.41/ → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
