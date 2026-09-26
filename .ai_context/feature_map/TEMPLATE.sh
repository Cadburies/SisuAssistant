#!/usr/bin/env bash
# <id> — reach + read <feature>. Mode: read.   Usage: <name>.sh [--open] [--actuate]
# Modes: read (default) · actuate (reversible change, needs --actuate) · safety-critical
# (field/relays/Spectra: needs --actuate plus FM_OPERATOR=<human>; never touches hard ceilings).
set -uo pipefail
FM_ID=<id>
FM_MODE=read
source "$(dirname "$0")/<../ per folder level>_lib.sh"
URL="<exact URL>"

need_tcp <host> <port> "<label>"          # exit 2 (SKIP) when off-vessel
[[ "${1:-}" == "--open" ]] && fm_open "$URL"
# fm_gate "$@"                            # uncomment for actuate / safety-critical scripts

state=$(ha_state <entity_id>)             # or sk_get / nav_get / esp_get once #140 adds them
echo "<label>: $state"

case "$state" in
  "<missing>"|"<error>") fm_result "$FM_ID" unexpected "$state"; exit 1 ;;
  *)                     fm_result "$FM_ID" ok "$state";         exit 0 ;;
esac
