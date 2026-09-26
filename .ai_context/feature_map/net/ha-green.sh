#!/usr/bin/env bash
# net/ha-green — reach + read Network › HA Green (192.168.0.20). Mode: read.   Usage: ha-green.sh [--open]
set -uo pipefail
FM_ID=net/ha-green
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
URL="http://192.168.0.20:8123"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$(curl -s -m 5 -H "Authorization: Bearer $(secret ha_token)" http://192.168.0.20:8123/api/)
echo "$out" | head -c 400; echo
if [[ "$out" == *"API running"* ]]; then fm_result "$FM_ID" ok "HA API running"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
