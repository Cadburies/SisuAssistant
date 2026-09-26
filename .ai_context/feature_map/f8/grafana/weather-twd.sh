#!/usr/bin/env bash
# f8/grafana/weather-twd — reach Grafana › WeatherTWD. Mode: read.   Usage: weather-twd.sh [--open]
set -uo pipefail
FM_ID=f8/grafana/weather-twd
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:3001/d/sisu-weather-twd"

need_tcp 192.168.0.21 3001 "Grafana"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.21:3001/d/sisu-weather-twd")
echo "  http://192.168.0.21:3001/d/sisu-weather-twd → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
