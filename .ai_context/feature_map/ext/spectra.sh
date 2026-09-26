#!/usr/bin/env bash
# ext/spectra — reach Spectra Newport 400c watermaker. Mode: read.   Usage: spectra.sh [--open]
set -uo pipefail
FM_ID=ext/spectra
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
URL="http://192.168.0.25/"

need_tcp 192.168.0.25 80 "Spectra"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://192.168.0.25/")
echo "  http://192.168.0.25/ → HTTP $code"
case "$code" in 2*|3*|401) fm_result "$FM_ID" ok "HTTP $code"; exit 0 ;;
                *)         fm_result "$FM_ID" unexpected "HTTP $code"; exit 1 ;; esac
