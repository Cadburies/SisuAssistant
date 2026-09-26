#!/usr/bin/env bash
# f8/grafana/weather — reach Grafana › WeatherAWA. Mode: read.   Usage: weather.sh [--open]
set -uo pipefail
FM_ID=f8/grafana/weather
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:3001/d/sisu-weather"

need_tcp 192.168.0.21 3001 "Grafana"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.21:3001/d/sisu-weather")
echo "  http://192.168.0.21:3001/d/sisu-weather → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
