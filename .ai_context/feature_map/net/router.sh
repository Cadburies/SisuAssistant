#!/usr/bin/env bash
# net/router — reach Network › Router & firewall rules. Mode: read.   Usage: router.sh [--open]
set -uo pipefail
FM_ID=net/router
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
URL="http://192.168.0.1"

need_tcp 192.168.0.1 80 "router"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.1/")
echo "  http://192.168.0.1/ → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
