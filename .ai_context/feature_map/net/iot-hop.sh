#!/usr/bin/env bash
# net/iot-hop — reach + read Network › Reaching IoT devices. Mode: read.   Usage: iot-hop.sh [--open]
set -uo pipefail
FM_ID=net/iot-hop
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
URL="http://192.168.10.45/"

need_tcp 192.168.0.20 22 "HA Green SSH"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$("$FM_ROOT/scripts/ha-ssh.sh" "curl -s -o /dev/null -w %{http_code} -m 4 http://192.168.10.45/" 2>/dev/null)
echo "$out" | head -c 400; echo
if [[ "$out" == 200 ]]; then fm_result "$FM_ID" ok "saloon display .45 reachable via hop"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
