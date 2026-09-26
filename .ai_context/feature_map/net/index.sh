#!/usr/bin/env bash
# net — reach + read Network › Vessel networks. Mode: read.   Usage: index.sh [--open]
set -uo pipefail
FM_ID=net
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
URL="http://192.168.0.1"

need_tcp 192.168.0.20 8123 "Sisu LAN (HA Green)"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://192.168.0.1/)
echo "$out" | head -c 400; echo
if [[ "$out" =~ ^[23] ]]; then fm_result "$FM_ID" ok "router answers"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
