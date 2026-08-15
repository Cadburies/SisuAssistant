#!/usr/bin/env bash
# Create Influx Sisu_raw + Sisu_1m and the 1-minute downsample task (#47).
# Reads org/token from homeassistant/.env — never prints the token.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/homeassistant/.env"
TASK_DIR="$REPO_ROOT/homeassistant/influx-tasks"
CONTAINER="${INFLUX_CONTAINER:-influxdb-mac}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing $ENV_FILE — run scripts/gen-docker-env.sh" >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

ORG="${INFLUXDB_ORG:?}"
TOKEN="${INFLUXDB_TOKEN:?}"
cli() { docker exec "$CONTAINER" influx "$@" --org "$ORG" --token "$TOKEN"; }

echo "org=$ORG container=$CONTAINER"
# Create buckets if missing
if ! cli bucket list --hide-headers 2>/dev/null | awk '{print $2}' | grep -qx Sisu_raw; then
  cli bucket create --name Sisu_raw --retention 168h
  echo "created Sisu_raw (7d retention)"
else
  echo "Sisu_raw exists"
fi
if ! cli bucket list --hide-headers 2>/dev/null | awk '{print $2}' | grep -qx Sisu_1m; then
  cli bucket create --name Sisu_1m --retention 0
  echo "created Sisu_1m (infinite retention)"
else
  echo "Sisu_1m exists"
fi

apply_task() {
  local name="$1" file="$2"
  local id
  id=$(cli task list --hide-headers 2>/dev/null | awk -v n="$name" '{
    for (i=1;i<=NF;i++) if ($i==n) { print $1; exit }
  }')
  if [[ -n "${id:-}" ]]; then
    docker exec "$CONTAINER" influx task delete --id "$id" --token "$TOKEN" >/dev/null
    echo "replaced task $name ($id)"
  fi
  docker exec -i "$CONTAINER" influx task create --org "$ORG" --token "$TOKEN" < "$file"
  echo "applied $name"
}

apply_task sisu_1m "$TASK_DIR/sisu_1m.flux"
apply_task sisu_raw_mirror "$TASK_DIR/sisu_raw_mirror.flux"
