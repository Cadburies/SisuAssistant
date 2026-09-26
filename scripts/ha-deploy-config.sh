#!/usr/bin/env bash
# Deploy selected local files to HA Green /config.
# SFTP is disabled on Advanced SSH; transfer is SSH stdin + sudo cp.
#
# Usage:
#   ./scripts/ha-deploy-config.sh
#   ./scripts/ha-deploy-config.sh homeassistant/configuration.yaml
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
SSH_CMD=("$REPO_ROOT/scripts/ha-ssh.sh")
SECRETS="$REPO_ROOT/homeassistant/secrets.yaml"

chmod +x "$REPO_ROOT/scripts/ha-ssh.sh" 2>/dev/null || true

read_secret() {
  awk -F': *' -v k="$1" '$1==k {gsub(/["'\'']/, "", $2); print $2; exit}' "$SECRETS" 2>/dev/null || true
}
SUDO_PASS="$(read_secret ha_ssh_password)"
: "${SUDO_PASS:?ha_ssh_password missing in homeassistant/secrets.yaml}"

# One remote shell that: receives base64 on stdin after password line is not needed —
# we use two steps; cache sudo with -v first.
"${SSH_CMD[@]}" "echo '$SUDO_PASS' | sudo -S -v" 2>/dev/null || true

put() {
  local src="$1"
  local dest="$2"
  [[ -f "$src" ]] || { echo "missing $src" >&2; return 1; }
  local local_bytes
  local_bytes=$(wc -c < "$src" | tr -d ' ')

  # Stream raw bytes to /tmp (user-writable)
  cat "$src" | "${SSH_CMD[@]}" "cat > /tmp/ha-put.bin && wc -c < /tmp/ha-put.bin" >/tmp/ha-put-stage.wc
  local staged
  staged=$(tr -d ' \r\n' </tmp/ha-put-stage.wc)
  if [[ "$staged" != "$local_bytes" ]]; then
    echo "ERROR: stage failed $src local=$local_bytes staged=$staged" >&2
    return 1
  fi

  # sudo cp (password on sudo stdin; parse marked size so prompts cannot pollute)
  local remote_out
  remote_out=$("${SSH_CMD[@]}" \
    "echo '$SUDO_PASS' | sudo -S cp /tmp/ha-put.bin '$dest' >/dev/null 2>&1; echo '$SUDO_PASS' | sudo -S sh -c 'printf SIZE:%s\\\\n \"\$(wc -c < \"$dest\")\"' 2>/dev/null" \
    | sed -n 's/^SIZE://p' | tr -d ' \r\n' | tail -1)

  if [[ "$remote_out" != "$local_bytes" ]]; then
    echo "ERROR: size mismatch $src local=$local_bytes remote=$remote_out" >&2
    return 1
  fi
  echo "deployed $src -> $dest ($local_bytes bytes)"
}

DEFAULT_FILES=(
  homeassistant/configuration.yaml:/config/configuration.yaml
  homeassistant/automations.yaml:/config/automations.yaml
  homeassistant/scripts.yaml:/config/scripts.yaml
  homeassistant/scenes.yaml:/config/scenes.yaml
  homeassistant/secrets.yaml:/config/secrets.yaml
  homeassistant/esphome/packages/marine_board_base.yaml:/config/esphome/packages/marine_board_base.yaml
  homeassistant/esphome/packages/marine_alternator.yaml:/config/esphome/packages/marine_alternator.yaml
  homeassistant/esphome/alternatorport.yaml:/config/esphome/alternatorport.yaml
  homeassistant/esphome/alternatorstarboard.yaml:/config/esphome/alternatorstarboard.yaml
  homeassistant/esphome/waterlevels.yaml:/config/esphome/waterlevels.yaml
  homeassistant/esphome/freezer.yaml:/config/esphome/freezer.yaml
  homeassistant/esphome/bench_t8s3.yaml:/config/esphome/bench_t8s3.yaml
)

"${SSH_CMD[@]}" "echo '$SUDO_PASS' | sudo -S mkdir -p /config/esphome/packages /config/themes /config/www" 2>/dev/null
"${SSH_CMD[@]}" "echo '$SUDO_PASS' | sudo -S ln -sfn /config/secrets.yaml /config/esphome/secrets.yaml" 2>/dev/null

if [[ $# -eq 0 ]]; then
  for pair in "${DEFAULT_FILES[@]}"; do
    put "${pair%%:*}" "${pair##*:}"
  done
else
  for src in "$@"; do
    case "$src" in
      homeassistant/esphome/*) dest="/config/esphome/${src#homeassistant/esphome/}" ;;
      homeassistant/*) dest="/config/${src#homeassistant/}" ;;
      *) echo "skip unknown path $src" >&2; continue ;;
    esac
    dir=$(dirname "$dest")
    "${SSH_CMD[@]}" "echo '$SUDO_PASS' | sudo -S mkdir -p '$dir'" 2>/dev/null
    put "$src" "$dest"
  done
fi

echo "Deploy complete. Restart Core if homeassistant: block changed."
