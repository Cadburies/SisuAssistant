#!/usr/bin/env bash
# Create Influx Sisu_raw + Sisu_1m and the 1-minute downsample tasks (#47).
# Default target: the F8 (#6) — runs `influx` inside its `influxdb` container,
# which already holds the operator config, so no token leaves this Mac (#169).
# --org is passed per command: `influx task delete` rejects it.
# INFLUX_TARGET=mac: the retired Mac stack (reads org/token from homeassistant/.env).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_DIR="$REPO_ROOT/homeassistant/influx-tasks"
TARGET="${INFLUX_TARGET:-f8}"
ORG="${INFLUXDB_ORG:-Sisu}"

if [[ "$TARGET" == f8 ]]; then
  CONTAINER="${INFLUX_CONTAINER:-influxdb}"
  F8_DOCKER="/Volume1/@apps/DockerEngine/dockerd/bin/docker"   # not on TOS's $PATH (OPS.md §7)
  cli() { "$REPO_ROOT/scripts/f8-ssh.sh" "$F8_DOCKER exec -i $CONTAINER influx $(printf '%q ' "$@")" 2>/dev/null; }
else
  ENV_FILE="$REPO_ROOT/homeassistant/.env"
  CONTAINER="${INFLUX_CONTAINER:-influxdb-mac}"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "missing $ENV_FILE — run scripts/gen-docker-env.sh" >&2
    exit 1
  fi
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
  ORG="${INFLUXDB_ORG:?}"
  TOKEN="${INFLUXDB_TOKEN:?}"
  cli() { docker exec -i "$CONTAINER" influx "$@" --token "$TOKEN"; }
fi
echo "target=$TARGET org=$ORG container=$CONTAINER"
# Create buckets if missing
if ! cli bucket list --org "$ORG" --hide-headers 2>/dev/null | awk '{print $2}' | grep -qx Sisu_raw; then
  cli bucket create --org "$ORG" --name Sisu_raw --retention 168h
  echo "created Sisu_raw (7d retention)"
else
  echo "Sisu_raw exists"
fi
if ! cli bucket list --org "$ORG" --hide-headers 2>/dev/null | awk '{print $2}' | grep -qx Sisu_1m; then
  cli bucket create --org "$ORG" --name Sisu_1m --retention 0
  echo "created Sisu_1m (infinite retention)"
else
  echo "Sisu_1m exists"
fi

apply_task() {
  local name="$1" file="$2"
  local id
  id=$(cli task list --org "$ORG" --hide-headers 2>/dev/null | awk -v n="$name" '{
    for (i=1;i<=NF;i++) if ($i==n) { print $1; exit }
  }')
  if [[ -n "${id:-}" ]]; then
    cli task delete --id "$id" >/dev/null
    echo "replaced task $name ($id)"
  fi
  cli task create --org "$ORG" < "$file"
  echo "applied $name"
}

apply_task sisu_1m "$TASK_DIR/sisu_1m.flux"
apply_task sisu_raw_mirror "$TASK_DIR/sisu_raw_mirror.flux"
