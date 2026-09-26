#!/usr/bin/env bash
# net/f8 — reach + read Network › F8 server (192.168.0.21). Mode: read.   Usage: f8.sh [--open]
set -uo pipefail
FM_ID=net/f8
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
URL="http://192.168.0.21:3000"

need_tcp 192.168.0.21 3000 "F8"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$(for p in 3000 3001 4000 8086 8088; do nc -z -G 2 192.168.0.21 $p >/dev/null 2>&1 && echo "$p open" || echo "$p closed"; done)
echo "$out" | head -c 400; echo
if [[ "$out" != *closed* ]]; then fm_result "$FM_ID" ok "all service ports open"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
