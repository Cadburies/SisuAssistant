#!/usr/bin/env bash
# ha/kernel/alerts — reach + read Kernel › Ingest & polar alerts. Mode: read.   Usage: alerts.sh [--open]
set -uo pipefail
FM_ID=ha/kernel/alerts
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/config/automation/dashboard"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in automation.sisu_nmea_ingest_both_sources_down_alert automation.sisu_nmea_ingest_recovered_clear_alert automation.sisu_engine_rpm_unknown_polar_data_paused automation.sisu_engine_rpm_recovered_clear_polar_alert; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 4 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "4 entities present"; exit 0
