#!/usr/bin/env bash
# f8/grafana/power-charging — reach Grafana › Power & Charging. Mode: read.   Usage: power-charging.sh [--open]
set -uo pipefail
FM_ID=f8/grafana/power-charging
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:3001/d/sisu-power-charging"

need_tcp 192.168.0.21 3001 "Grafana"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.21:3001/d/sisu-power-charging")
echo "  http://192.168.0.21:3001/d/sisu-power-charging → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
