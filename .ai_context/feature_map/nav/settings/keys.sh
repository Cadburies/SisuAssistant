#!/usr/bin/env bash
# nav/settings/keys — reach Sisu Nav › Settings (API keys). Mode: read.   Usage: keys.sh [--open]
set -uo pipefail
FM_ID=nav/settings/keys
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:8088"

need_tcp 192.168.0.21 8088 "Sisu Nav"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.21:8088/api/settings/keys")
echo "  http://192.168.0.21:8088/api/settings/keys → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
