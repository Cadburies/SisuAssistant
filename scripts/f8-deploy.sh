#!/usr/bin/env bash
# Push the F8-target stack (homeassistant/docker-compose.yml + its config
# trees + the sisu-nav source it builds from) from this Mac checkout to the
# TerraMaster F8 over rsync/scp. F8's App Center Docker has no compiler/git
# story of its own (TOS blocks direct apt/dpkg use — an appliance OS, not a
# general Debian box) so this Mac stays the build/push side, matching
# ha-deploy-config.sh's own "push from Mac" model (#6).
#
# Usage: ./scripts/f8-deploy.sh [--secrets]
#   --secrets   also (re)copy homeassistant/secrets.yaml and a freshly
#               generated homeassistant/.env — omit on routine code-only
#               redeploys so a stale local .env can't clobber F8's.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="${REPO_ROOT}/homeassistant/secrets.yaml"
HOST="${F8_SSH_HOST:-192.168.0.21}"
PORT="${F8_SSH_PORT:-22}"
USER="${F8_SSH_USER:-Sisu}"
REMOTE_ROOT="/Volume1/docker/SisuAssistant"

read_secret() {
  local key="$1"
  # shellcheck disable=SC2016
  awk -F': *' -v k="$key" '$1==k {gsub(/["'\'']/, "", $2); print $2; exit}' "$SECRETS" 2>/dev/null || true
}
if [[ -f "$SECRETS" ]]; then
  HOST="$(read_secret f8_ssh_host || true)"; HOST="${HOST:-192.168.0.21}"
  PORT="$(read_secret f8_ssh_port || true)"; PORT="${PORT:-22}"
  USER="$(read_secret f8_ssh_user || true)"; USER="${USER:-Sisu}"
  PASS="$(read_secret f8_ssh_password || true)"
fi

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -p "$PORT")
RSYNC_SSH="ssh ${SSH_OPTS[*]}"
if [[ -f "$HOME/.ssh/id_devman" ]] && ssh -i "$HOME/.ssh/id_devman" -o IdentitiesOnly=yes \
    -o PreferredAuthentications=publickey -o PasswordAuthentication=no -o BatchMode=yes \
    -o ConnectTimeout=5 -p "$PORT" "${USER}@${HOST}" true </dev/null 2>/dev/null; then
  RSYNC_SSH="ssh -i $HOME/.ssh/id_devman -o IdentitiesOnly=yes -o PreferredAuthentications=publickey ${SSH_OPTS[*]}"
  SSH_RUN=(ssh -i "$HOME/.ssh/id_devman" -o IdentitiesOnly=yes -o PreferredAuthentications=publickey "${SSH_OPTS[@]}" "${USER}@${HOST}")
elif command -v sshpass >/dev/null 2>&1 && [[ -n "${PASS:-}" ]]; then
  RSYNC_SSH="sshpass -p $PASS ssh ${SSH_OPTS[*]}"
  SSH_RUN=(sshpass -p "$PASS" ssh "${SSH_OPTS[@]}" "${USER}@${HOST}")
else
  echo "Cannot reach ${USER}@${HOST}:${PORT}. Install key or set f8_ssh_password in secrets.yaml." >&2
  exit 1
fi

echo "==> ensuring remote dirs"
"${SSH_RUN[@]}" "mkdir -p ${REMOTE_ROOT}/homeassistant/mqtt-explorer/{config,data,log} ${REMOTE_ROOT}/homeassistant/grafana ${REMOTE_ROOT}/homeassistant/influxdb ${REMOTE_ROOT}/sisu-nav/tiles/{manual,inbox,bathymetry,satellite,nautical} ${REMOTE_ROOT}/sisu-nav/api/data && chmod -R a+rwX ${REMOTE_ROOT}/sisu-nav/tiles ${REMOTE_ROOT}/sisu-nav/api/data"

# Mac = source of truth (#181). Box runtime state is never pushed over: Signal K
# serverState/applicationData/appstore-cache/security.json (admin-UI users,
# saved KIP layouts) stay as the F8 wrote them. Keep excludes in sync with
# scripts/stack-drift.sh.
echo "==> syncing homeassistant/ config (excluding runtime/gitignored dirs)"
rsync -az --delete -e "$RSYNC_SSH" \
  --exclude 'secrets.yaml' --exclude '.env' \
  --exclude 'grafana/' --exclude 'influxdb/' --exclude 'mqtt-explorer/data/' --exclude 'mqtt-explorer/log/' \
  --exclude 'esphome/.esphome/' --exclude '.DS_Store' \
  --exclude 'signalk/serverState/' --exclude 'signalk/applicationData/' --exclude 'signalk/appstore-cache/' \
  --exclude 'signalk/security.json' \
  "${REPO_ROOT}/homeassistant/" "${USER}@${HOST}:${REMOTE_ROOT}/homeassistant/"

echo "==> syncing sisu-nav/ source (excluding node_modules/dist/tiles)"
rsync -az --delete -e "$RSYNC_SSH" \
  --exclude 'node_modules/' --exclude 'dist/' --exclude 'tiles/' --exclude '.DS_Store' \
  "${REPO_ROOT}/sisu-nav/" "${USER}@${HOST}:${REMOTE_ROOT}/sisu-nav/"

if [[ "${1:-}" == "--secrets" ]]; then
  echo "==> pushing secrets.yaml + fresh .env"
  # scp/sftp against this TOS sshd closes the connection (custom sshd build,
  # sftp-server subsystem quirk) - rsync-over-ssh works fine, use that instead.
  "${REPO_ROOT}/scripts/gen-docker-env.sh" >/dev/null
  rsync -az -e "$RSYNC_SSH" "$SECRETS" "${USER}@${HOST}:${REMOTE_ROOT}/homeassistant/secrets.yaml"
  rsync -az -e "$RSYNC_SSH" "${REPO_ROOT}/homeassistant/.env" "${USER}@${HOST}:${REMOTE_ROOT}/homeassistant/.env"
fi

echo "==> done. Deployed to ${USER}@${HOST}:${REMOTE_ROOT}"
