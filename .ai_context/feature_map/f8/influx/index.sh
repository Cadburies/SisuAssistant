#!/usr/bin/env bash
# f8/influx — reach + read InfluxDB › UI & buckets. Mode: read.   Usage: index.sh [--open]
set -uo pipefail
FM_ID=f8/influx
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:8086"

need_tcp 192.168.0.21 8086 "InfluxDB"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$(curl -s -m 5 http://192.168.0.21:8086/health)
echo "$out" | head -c 400; echo
if [[ "$out" == *'"status":"pass"'* ]]; then fm_result "$FM_ID" ok "influx healthy"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
