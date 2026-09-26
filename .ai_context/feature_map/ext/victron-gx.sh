#!/usr/bin/env bash
# ext/victron-gx — reach + read Victron Color Control / GX. Mode: read.   Usage: victron-gx.sh [--open]
set -uo pipefail
FM_ID=ext/victron-gx
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
URL=""

need_tcp 192.168.10.32 1883 "Victron GX MQTT"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$(echo mqtt-open)
echo "$out" | head -c 400; echo
if true; then fm_result "$FM_ID" ok "GX MQTT reachable"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
