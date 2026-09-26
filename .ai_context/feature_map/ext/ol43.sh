#!/usr/bin/env bash
# ext/ol43 — Veratron OL43 helm display (planned). Documentation only (no live endpoint). Mode: read.
set -uo pipefail
FM_ID=ext/ol43
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
for f in 'NETWORK.md'; do [[ -e "$FM_ROOT/$f" ]] || { fm_result "$FM_ID" unexpected "missing $f"; exit 1; }; echo "  $f"; done
fm_result "$FM_ID" ok "source docs present"; exit 0
