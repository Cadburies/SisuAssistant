#!/usr/bin/env bash
# f8/signalk/api — reach + read Signal K › REST data API. Mode: read.   Usage: api.sh [--open]
set -uo pipefail
FM_ID=f8/signalk/api
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.21:3000/signalk"

need_tcp 192.168.0.21 3000 "Signal K"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$(sk_get vessels/self/navigation/speedOverGround)
echo "$out" | head -c 400; echo
if [[ "$out" == *'"value"'* ]]; then fm_result "$FM_ID" ok "SOG path readable"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
