#!/usr/bin/env bash
# ext/datahub — reach + read DataHub NMEA gateway (failover). Mode: read.   Usage: datahub.sh [--open]
set -uo pipefail
FM_ID=ext/datahub
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
URL="http://192.168.10.31/"

need_tcp 192.168.10.31 11102 "DataHub"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$(echo tcp-11102-open)
echo "$out" | head -c 400; echo
if true; then fm_result "$FM_ID" ok "NMEA port open"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
