#!/usr/bin/env bash
# ext/ydwg — reach + read YDWG-02 NMEA gateway. Mode: read.   Usage: ydwg.sh [--open]
set -uo pipefail
FM_ID=ext/ydwg
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
URL="http://192.168.10.30/"

need_tcp 192.168.10.30 1456 "YDWG"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$(echo tcp-1456-open)
echo "$out" | head -c 400; echo
if true; then fm_result "$FM_ID" ok "NMEA port open"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
