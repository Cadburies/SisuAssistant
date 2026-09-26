#!/usr/bin/env bash
# ha/water/spectra-web-ui — reach Water › Spectra web UI. Mode: read.   Usage: spectra-web-ui.sh [--open]
set -uo pipefail
FM_ID=ha/water/spectra-web-ui
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.25/"

need_tcp 192.168.0.25 80 "Spectra controller"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.25/")
echo "  http://192.168.0.25/ → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
