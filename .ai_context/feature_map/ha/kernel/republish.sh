#!/usr/bin/env bash
# ha/kernel/republish — reach + read Kernel › MQTT/Signal K republish automations. Mode: read.   Usage: republish.sh [--open]
set -uo pipefail
FM_ID=ha/kernel/republish
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/config/automation/dashboard"

need_tcp 192.168.0.20 8123 "HA Green"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

bad=0
for e in automation.sisu_alternator_port_mqtt_signal_k automation.sisu_alternator_starboard_mqtt_signal_k automation.sisu_house_voltage_saloon_mqtt_signal_k automation.sisu_aws_1h_trend_mqtt_saloon_display_sparkline; do
  s=$(ha_state "$e"); echo "  $e: $s"
  [[ "$s" == "<missing>" || "$s" == "<error>" ]] && bad=$((bad+1))
done
if (( bad )); then fm_result "$FM_ID" unexpected "$bad of 4 entities missing"; exit 1; fi
fm_result "$FM_ID" ok "4 entities present"; exit 0
