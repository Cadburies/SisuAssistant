#!/usr/bin/env bash
# scp wrapper using the same auth as scripts/ha-ssh.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="${REPO_ROOT}/homeassistant/secrets.yaml"
HOST="${HA_SSH_HOST:-192.168.0.20}"
PORT="${HA_SSH_PORT:-22}"
USER="${HA_SSH_USER:-sisu}"
IDENTITY="${HA_SSH_IDENTITY:-$HOME/.ssh/id_devman}"

read_secret() {
  local key="$1"
  awk -F': *' -v k="$key" '$1==k {gsub(/["'\'']/, "", $2); print $2; exit}' "$SECRETS" 2>/dev/null || true
}

if [[ -f "$SECRETS" ]]; then
  HOST="$(read_secret ha_ssh_host || true)"; HOST="${HOST:-192.168.0.20}"
  PORT="$(read_secret ha_ssh_port || true)"; PORT="${PORT:-22}"
  USER="$(read_secret ha_ssh_user || true)"; USER="${USER:-sisu}"
  PASS="$(read_secret ha_ssh_password || true)"
fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <local...> <remote-path-under-/config or user@host:path>" >&2
  echo "  Example: $0 homeassistant/configuration.yaml /config/configuration.yaml" >&2
  exit 2
fi

# Last arg is remote destination; if it starts with / treat as path on Green
args=("$@")
dest="${args[-1]}"
unset 'args[-1]'
if [[ "$dest" == /* ]]; then
  dest="${USER}@${HOST}:${dest}"
fi

SCP_BASE=(scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -P "$PORT")

if [[ -f "$IDENTITY" ]] && ssh -i "$IDENTITY" -o IdentitiesOnly=yes -o PreferredAuthentications=publickey \
    -o PasswordAuthentication=no -o BatchMode=yes -o ConnectTimeout=5 \
    -p "$PORT" "${USER}@${HOST}" true </dev/null 2>/dev/null; then
  exec "${SCP_BASE[@]}" -i "$IDENTITY" -o IdentitiesOnly=yes "${args[@]}" "$dest"
fi

if command -v sshpass >/dev/null 2>&1 && [[ -n "${PASS:-}" ]]; then
  exec sshpass -p "$PASS" "${SCP_BASE[@]}" \
    -o PreferredAuthentications=password -o PubkeyAuthentication=no \
    "${args[@]}" "$dest"
fi

echo "Cannot scp to Green. Fix SSH first (see OPS.md)." >&2
exit 1
