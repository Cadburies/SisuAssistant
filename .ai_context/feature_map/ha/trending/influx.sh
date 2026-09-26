#!/usr/bin/env bash
# ha/trending/influx — reach + read Trending › HA → InfluxDB. Mode: read.   Usage: influx.sh [--open]
set -uo pipefail
FM_ID=ha/trending/influx
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:8086"

need_tcp 192.168.0.21 8086 "InfluxDB"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$(curl -s -m 5 http://192.168.0.21:8086/health)
echo "$out" | head -c 400; echo
if [[ "$out" == *'"status":"pass"'* ]]; then fm_result "$FM_ID" ok "influx healthy"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
