#!/usr/bin/env bash
# hw/marine-board/can-relay — Marine Board › CAN, relay & I²C. Documentation only (no live endpoint). Mode: read.
set -uo pipefail
FM_ID=hw/marine-board/can-relay
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
for f in 'MarineBoard/Technical Specs.md' 'MarineBoard/MarineBoard.kicad_sch'; do [[ -e "$FM_ROOT/$f" ]] || { fm_result "$FM_ID" unexpected "missing $f"; exit 1; }; echo "  $f"; done
fm_result "$FM_ID" ok "source docs present"; exit 0
