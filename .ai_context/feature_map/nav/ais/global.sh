#!/usr/bin/env bash
# nav/ais/global — reach Sisu Nav › AIS (global, internet). Mode: read.   Usage: global.sh [--open]
set -uo pipefail
FM_ID=nav/ais/global
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:8088"

need_tcp 192.168.0.21 8088 "Sisu Nav"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

body=$(curl -s --max-time 12 "http://192.168.0.21:8088/api/ais-global/vessels")
echo "  /api/ais-global/vessels → $(echo "$body" | head -c 120)"
if [[ "$body" == *'"connected":true'* ]]; then fm_result "$FM_ID" ok "AISStream connected"; exit 0; fi
fm_result "$FM_ID" unexpected "AISStream not connected"; exit 1
