#!/usr/bin/env bash
# esp/bench — Bench Marine Board (lab). Documentation only (no live endpoint). Mode: read.
set -uo pipefail
FM_ID=esp/bench
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
for f in 'homeassistant/esphome/bench_marine_board.yaml'; do [[ -e "$FM_ROOT/$f" ]] || { fm_result "$FM_ID" unexpected "missing $f"; exit 1; }; echo "  $f"; done
fm_result "$FM_ID" ok "source docs present"; exit 0
