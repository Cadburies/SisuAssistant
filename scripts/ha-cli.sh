#!/usr/bin/env bash
# Run Home Assistant CLI via hassio_cli container (works when protection mode is off / docker available).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH="$REPO_ROOT/scripts/ha-ssh.sh"
PASS=$(awk -F': *' '$1=="ha_ssh_password" {gsub(/["'\'']/, "", $2); print $2; exit}' "$REPO_ROOT/homeassistant/secrets.yaml" 2>/dev/null || true)
PASS=${PASS:-***REMOVED***}
exec "$SSH" "echo '$PASS' | sudo -S docker exec hassio_cli ha $(printf '%q ' "$@")"
