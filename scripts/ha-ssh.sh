#!/usr/bin/env bash
# Agent / operator helper: SSH to HA Green without typing passwords.
# Prefers SSH key (id_devman). Falls back to sshpass + secrets if needed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="${REPO_ROOT}/homeassistant/secrets.yaml"
HOST="${HA_SSH_HOST:-192.168.0.20}"
PORT="${HA_SSH_PORT:-22}"
USER="${HA_SSH_USER:-sisu}"
IDENTITY="${HA_SSH_IDENTITY:-$HOME/.ssh/id_devman}"

read_secret() {
  local key="$1"
  # shellcheck disable=SC2016
  awk -F': *' -v k="$key" '$1==k {gsub(/["'\'']/, "", $2); print $2; exit}' "$SECRETS" 2>/dev/null || true
}

if [[ -f "$SECRETS" ]]; then
  HOST="$(read_secret ha_ssh_host || true)"; HOST="${HOST:-192.168.0.20}"
  PORT="$(read_secret ha_ssh_port || true)"; PORT="${PORT:-22}"
  USER="$(read_secret ha_ssh_user || true)"; USER="${USER:-sisu}"
  PASS="$(read_secret ha_ssh_password || true)"
fi

SSH_BASE=(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -p "$PORT")

# Probe must not consume stdin (deploy pipes file contents into this script).
if [[ -f "$IDENTITY" ]] && ssh -i "$IDENTITY" -o IdentitiesOnly=yes -o PreferredAuthentications=publickey \
    -o PasswordAuthentication=no -o BatchMode=yes -o ConnectTimeout=5 \
    -p "$PORT" "${USER}@${HOST}" true </dev/null 2>/dev/null; then
  exec "${SSH_BASE[@]}" -i "$IDENTITY" -o IdentitiesOnly=yes -o PreferredAuthentications=publickey \
    "${USER}@${HOST}" "$@"
fi

if command -v sshpass >/dev/null 2>&1 && [[ -n "${PASS:-}" ]]; then
  exec sshpass -p "$PASS" "${SSH_BASE[@]}" \
    -o PreferredAuthentications=password -o PubkeyAuthentication=no \
    "${USER}@${HOST}" "$@"
fi

echo "Cannot SSH to ${USER}@${HOST}:${PORT}. Install key or set ha_ssh_password in secrets.yaml." >&2
exit 1
