#!/usr/bin/env bash
# ha/kernel/mqtt — reach + read Kernel › MQTT broker (sisu/v1). Mode: read.   Usage: mqtt.sh [--open]
set -uo pipefail
FM_ID=ha/kernel/mqtt
FM_MODE=read
source "$(dirname "$0")/../../_lib.sh"
URL="http://192.168.0.20:8123/hassio/addon/core_mosquitto/info"

need_tcp 192.168.0.20 1883 "MQTT broker"
[[ "${1:-}" == "--open" ]] && fm_open "$URL"

out=$(mqtt_peek sisu/v1/meta/datahub/live)
echo "$out" | head -c 400; echo
if [[ -n "$out" && "$out" != "<none>" ]]; then fm_result "$FM_ID" ok "kernel topic answered"; exit 0; fi
fm_result "$FM_ID" unexpected "$(echo "$out" | head -c 80)"; exit 1
