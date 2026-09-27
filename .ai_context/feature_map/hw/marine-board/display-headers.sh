#!/usr/bin/env bash
# hw/marine-board/display-headers — Display connector & GPIO headers. Documentation only (no live endpoint). Mode: read.
set -uo pipefail
FM_ID=hw/marine-board/display-headers
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
for f in 'MarineBoard/MarineBoard.kicad_sch' 'MarineBoard/Documentation/FSPI (new).png'; do [[ -e "$FM_ROOT/$f" ]] || { fm_result "$FM_ID" unexpected "missing $f"; exit 1; }; echo "  $f"; done
fm_result "$FM_ID" ok "source docs present"; exit 0
