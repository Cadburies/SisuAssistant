#!/usr/bin/env bash
# Mac-only bridge for the interim Docker stack (OPS.md §7, issue #24).
#
# Docker Desktop's Mac VM can't route container traffic into 192.168.10.x
# (Sisu-IoT) — see .ai_context/risks.md R34. This relays the DataHub/YDWG
# NMEA0183 TCP ports through the Mac itself (which *can* reach them) onto
# host.docker.internal, which Docker Desktop always exposes to containers.
#
# NOT needed on F8 — a real Linux host on this same LAN with true
# network_mode: host reaches 192.168.10.x directly. This script and the
# matching host.docker.internal entries in homeassistant/signalk/settings.json
# are a tracked, temporary Mac-only override — revert settings.json's
# pipedProviders hosts back to the real 192.168.10.x IPs before any F8 cutover.
set -euo pipefail

relay() {
  local name="$1" port="$2" target="$3"
  echo "relay: $name :$port -> $target"
  while true; do
    socat TCP-LISTEN:"$port",fork,reuseaddr TCP:"$target" || true
    echo "relay: $name dropped, restarting in 2s..." >&2
    sleep 2
  done
}

relay datahub 11102 192.168.10.31:11102 &
relay ydwg 1456 192.168.10.30:1456 &

wait
