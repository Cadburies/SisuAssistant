#!/usr/bin/env bash
# net/guest — Network › Sisu-Guest Wi-Fi. Documentation only (no live endpoint). Mode: read.
set -uo pipefail
FM_ID=net/guest
FM_MODE=read
source "$(dirname "$0")/../_lib.sh"
for f in 'NETWORK.md' 'scripts/gen_guest_wifi_qr.py'; do [[ -e "$FM_ROOT/$f" ]] || { fm_result "$FM_ID" unexpected "missing $f"; exit 1; }; echo "  $f"; done
fm_result "$FM_ID" ok "source docs present"; exit 0
