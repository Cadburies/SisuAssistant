#!/usr/bin/env bash
# esp/alt-port/commission-flow — Alternator › Shadow commissioning (flow). Documentation only (no live endpoint). Mode: read.
set -uo pipefail
FM_ID=esp/alt-port/commission-flow
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
for f in 'INSTALLATION.md' 'homeassistant/docs/ALTERNATOR_TUNING.md'; do [[ -e "$FM_ROOT/$f" ]] || { fm_result "$FM_ID" unexpected "missing $f"; exit 1; }; echo "  $f"; done
fm_result "$FM_ID" ok "source docs present"; exit 0
