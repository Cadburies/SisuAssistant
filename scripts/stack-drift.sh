#!/usr/bin/env bash
# Mac = source of truth for the HA Green + F8 stack (#181). Reports drift:
#   DIFF        file differs (Mac wins unless the box copy is a box-side edit
#               that must be pulled into the Mac first — review before pushing)
#   MAC-ONLY    on the Mac, missing on the box      -> push
#   BOX-ONLY    on the box, not on the Mac          -> pull into the Mac or remove
# Runtime state (HA .storage/db/logs, camera snapshots, ESPHome builds,
# Signal K serverState/applicationData/security.json, Influx/Grafana data)
# belongs to the box and is ignored.
#
# Usage: ./scripts/stack-drift.sh [green|f8|all]   (default all)
# Exit 0 = in sync, 1 = drift found, 2 = box unreachable.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
SECRETS="homeassistant/secrets.yaml"
TARGET="${1:-all}"
drift=0

secret() { awk -F': *' -v k="$1" '$1==k {gsub(/["'\'']/, "", $2); print $2; exit}' "$SECRETS" 2>/dev/null; }

# Paths (relative to homeassistant/) that make up HA Green's /config source.
GREEN_SCOPE='^(configuration\.yaml|automations\.yaml|scripts\.yaml|scenes\.yaml|ui-lovelace\.yaml|secrets\.yaml|packages/|python_scripts/|dashboards/|themes/|www/|esphome/|blueprints/|mosquitto/|docs/|nmea_wind_daemon/|custom_templates/)'
GREEN_RUNTIME='^(www/[a-z_]+_snapshots/|www/[a-z_]+_camera_latest\.jpg|esphome/\.esphome/|esphome/\.git/|esphome/\.device-builder|esphome/archive/|esphome/images/|secrets\.yaml\.example$)'

check_green() {
  echo "== HA Green (/config) vs Mac homeassistant/"
  if ! ./scripts/ha-ssh.sh true >/dev/null 2>&1; then echo "  unreachable"; return 2; fi
  local box mac
  box=$(./scripts/ha-ssh.sh "sudo sh -c 'cd /config && find . -type f \
      -not -path \"./.storage/*\" -not -path \"./.cloud/*\" -not -path \"./.cache/*\" \
      -not -path \"./deps/*\" -not -path \"./tts/*\" -not -path \"./image/*\" \
      -not -path \"*/__pycache__/*\" -not -name \"*.db*\" -not -name \"*.log*\" \
      -not -name \".HA_VERSION\" -not -name \".ha_run.lock\" -print0 | xargs -0 sha256sum'" 2>/dev/null \
      | sed 's#  \./#  #' | awk '{print $2" "$1}' | grep -E " " | grep -E "$GREEN_SCOPE" | grep -v -E "$GREEN_RUNTIME" | sort)
  mac=$( { git ls-files homeassistant; git ls-files --others --exclude-standard homeassistant; echo homeassistant/secrets.yaml; } \
      | sed 's#^homeassistant/##' | grep -E "$GREEN_SCOPE" | grep -v -E "$GREEN_RUNTIME" | sort -u \
      | while read -r f; do [[ -f "homeassistant/$f" ]] && echo "$f $(shasum -a 256 "homeassistant/$f" | cut -d' ' -f1)"; done)
  local n=0
  while read -r status f; do
    [[ -z "$f" ]] && continue
    echo "  $status $f"; n=$((n + 1))
  done < <(join -a1 -a2 -e MISSING -o 0,1.2,2.2 <(echo "$mac") <(echo "$box") \
           | awk '$2=="MISSING"{print "BOX-ONLY",$1; next} $3=="MISSING"{print "MAC-ONLY",$1; next} $2!=$3{print "DIFF",$1}')
  [[ $n -eq 0 ]] && echo "  in sync" || drift=1
}

check_f8() {
  echo "== F8 (/Volume1/docker/SisuAssistant) vs Mac"
  local host port user rs
  host=$(secret f8_ssh_host); host=${host:-192.168.0.21}
  port=$(secret f8_ssh_port); port=${port:-22}
  user=$(secret f8_ssh_user); user=${user:-Sisu}
  export SSHPASS; SSHPASS=$(secret f8_ssh_password)
  rs="sshpass -e ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -p $port"
  local out
  # Excludes must match scripts/f8-deploy.sh.
  if ! out=$(rsync -anci --delete -e "$rs" \
      --exclude 'secrets.yaml' --exclude '.env' --exclude 'grafana/' --exclude 'influxdb/' \
      --exclude 'mqtt-explorer/data/' --exclude 'mqtt-explorer/log/' --exclude 'esphome/.esphome/' --exclude '.DS_Store' \
      --exclude 'signalk/serverState/' --exclude 'signalk/applicationData/' --exclude 'signalk/appstore-cache/' \
      --exclude 'signalk/security.json' \
      homeassistant/ "$user@$host:/Volume1/docker/SisuAssistant/homeassistant/" 2>/dev/null); then
    echo "  unreachable"; return 2
  fi
  out+=$'\n'$(rsync -anci --delete -e "$rs" --exclude 'node_modules/' --exclude 'dist/' --exclude 'tiles/' --exclude 'state/' --exclude '.DS_Store' \
      sisu-nav/ "$user@$host:/Volume1/docker/SisuAssistant/sisu-nav/" 2>/dev/null | sed 's#^\([^ ]*\) #\1 sisu-nav/#')
  # content changes / new files / deletions only (ignore dir + perm/time-only lines)
  local lines
  lines=$(echo "$out" | grep -E '^(<f[^ ]*c|<f\+\+\+|\*deleting)' \
          | sed -E 's/^\*deleting +/  BOX-ONLY /; s/^<f[^ ]*\+\+\+[^ ]* /  MAC-ONLY /; s/^<f[^ ]* /  DIFF /')
  if [[ -z "$lines" ]]; then echo "  in sync"; else echo "$lines"; drift=1; fi
}

rc=0
case "$TARGET" in
  green) check_green || rc=$? ;;
  f8)    check_f8 || rc=$? ;;
  all)   check_green || rc=$?; check_f8 || rc=$? ;;
  *) echo "usage: $0 [green|f8|all]" >&2; exit 64 ;;
esac
[[ $rc -eq 2 ]] && exit 2
exit $drift
