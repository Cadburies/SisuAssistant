#!/usr/bin/env bash
# ha/sisu/shortcuts — reach + read Sisu › Shortcuts (F8 web UIs). Mode: read.   Usage: shortcuts.sh [--open]
set -uo pipefail
FM_ID=ha/sisu/shortcuts
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/lovelace/default_view"

need_tcp 192.168.0.20 8123 "HA Green"
need_tcp 192.168.0.21 8088 "F8 Sisu Nav"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

# Every url_path in the Shortcuts section must answer HTTP.
urls=$(awk '/title: Shortcuts/{f=1;next} f&&/^  - title:|^      - type: grid/{f=0} f&&/url_path:/{print $2}' "$(dirname "$0")/../../../../homeassistant/ui-lovelace.yaml")
bad=0; n=0
for u in $urls; do
  n=$((n+1)); code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$u")
  echo "  $u → HTTP $code"
  [[ "$code" == "000" || "$code" -ge 500 ]] && bad=$((bad+1))
done
if (( n == 0 )); then fm_result "$FM_ID" unexpected "no Shortcuts urls found"; exit 1; fi
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of $n shortcuts unreachable"; exit 1; fi
fm_result "$FM_ID" ok "$n shortcuts reachable"; exit 0
