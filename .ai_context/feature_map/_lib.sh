# Feature Map shared helpers — sourced by every <feature>.sh. Read-only by default.
# Helpers: secret · need_tcp · ha_state · sk_get · nav_get · esp_get · mqtt_peek · fm_gate · fm_result · fm_open
# Live-verified 2026-09-26 (#140): ha_state sensor.sisu_route_status; sk_get navigation/speedOverGround (login
# with SignalKUser/SignalKPwd); nav_get health → {"ok":true}; mqtt_peek sisu/v1/meta/datahub/live → true;
# esp_get hop reaches .45 (only ESP online; it exposes no web_server entities → HTTP 404 is the device's answer).
# Exit codes: 0 expected state seen · 1 reachable but unexpected · 2 unreachable (SKIP) · 3 refused (gate)
FM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FM_SECRETS="$FM_ROOT/homeassistant/secrets.yaml"

# secret <key> — value from homeassistant/secrets.yaml; never echo it.
secret() { awk -F': *' -v k="$1" '$1==k {gsub(/["'\'']/, "", $2); print $2; exit}' "$FM_SECRETS" 2>/dev/null; }

# need_tcp <host> <port> <label> — exit 2 (SKIP) when not reachable from here.
need_tcp() {
  nc -z -G 2 "$1" "$2" >/dev/null 2>&1 || nc -z -w 2 "$1" "$2" >/dev/null 2>&1 \
    || { echo "SKIP: $3 ($1:$2) not reachable from this machine"; fm_result "${FM_ID:-?}" skip "$3 unreachable"; exit 2; }
}

# ha_state <entity_id> — prints the entity's state via HA REST (needs ha_host + ha_token).
ha_state() {
  curl -s --max-time 5 -H "Authorization: Bearer $(secret ha_token)" \
    "http://$(secret ha_host):8123/api/states/$1" \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("state","<missing>"))' 2>/dev/null || echo "<error>"
}

# sk_get <path> — Signal K REST on F8 (security on: logs in with SignalKUser/SignalKPwd inside
# python, so the password never hits argv), e.g. sk_get vessels/self/navigation/position (raw JSON).
sk_get() {
  python3 - "$FM_SECRETS" "$1" <<'PY' 2>/dev/null || echo "<error>"
import json, re, sys, urllib.request
s = {m[1]: m[2].strip().strip('"\'') for m in re.finditer(r'^(\w+):\s*(.*)$', open(sys.argv[1]).read(), re.M)}
base = f"http://{s['signalk_host']}:{s['signalk_port']}/signalk/v1"
req = urllib.request.Request(base + "/auth/login", method="POST", headers={"Content-Type": "application/json"},
                             data=json.dumps({"username": s["SignalKUser"], "password": s["SignalKPwd"]}).encode())
tok = json.load(urllib.request.urlopen(req, timeout=5))["token"]
req = urllib.request.Request(f"{base}/api/{sys.argv[2]}", headers={"Authorization": f"Bearer {tok}"})
print(urllib.request.urlopen(req, timeout=5).read().decode())
PY
}

# nav_get <route> — Sisu Nav API on F8 :8088, e.g. nav_get health (raw JSON).
nav_get() { curl -s --max-time 5 "http://$(secret signalk_host):8088/api/$1" || echo "<error>"; }

# esp_get <ip> <domain> <name> — ESPHome web_server state (JSON) via the HA Green hop
# (Sisu-IoT is only reachable from Green). Stages scripts/esphome_web_client.py in Green /tmp once.
esp_get() {
  local r="$FM_ROOT/scripts"
  "$r/ha-ssh.sh" 'test -f /tmp/esphome_web_client.py' 2>/dev/null \
    || "$r/ha-ssh.sh" 'cat > /tmp/esphome_web_client.py' < "$r/esphome_web_client.py" 2>/dev/null
    # (streams over ssh stdin: scripts/ha-scp.sh breaks on macOS bash 3.2 — negative array index)
  "$r/ha-ssh.sh" "python3 /tmp/esphome_web_client.py --host '$1' get '$2' '$3' 2>&1" 2>/dev/null \
    || { echo "<error>"; return 1; }       # device reply passed through, e.g. "HTTP 404: Not Found" = no such entity
}

# mqtt_peek <topic> — one message (retained or next within 5 s) from the Green broker, via the hop.
# Password travels on ssh stdin into a 0600 temp options file — never on a command line.
mqtt_peek() {
  printf '%s\n%s\n' "$(secret mqtt_username)" "$(secret mqtt_password)" | "$FM_ROOT/scripts/ha-ssh.sh" \
    "umask 077; d=\$(mktemp -d); read -r u; read -r p; printf -- '-u %s\n-P %s\n' \"\$u\" \"\$p\" > \$d/mosquitto_sub; \
     XDG_CONFIG_HOME=\$d mosquitto_sub -h $(secret mqtt_broker) -t '$1' -C 1 -W 5; rc=\$?; rm -rf \$d; exit \$rc" 2>/dev/null \
    || echo "<none>"
}

# fm_result <id> <ok|unexpected|skip|refused> <observed> — last stdout line, one JSON object.
fm_result() { python3 -c 'import json,sys; print(json.dumps({"id":sys.argv[1],"result":sys.argv[2],"observed":sys.argv[3]}))' "$1" "$2" "$3"; }

# fm_gate "$@" — refuse (exit 3) unless the caller opted in. FM_MODE: read | actuate | safety-critical.
fm_gate() {
  [[ "${FM_MODE:-read}" == read ]] && return 0
  [[ " $* " == *" --actuate "* ]] || { echo "DRY-RUN: $FM_ID is $FM_MODE — rerun with --actuate"; fm_result "$FM_ID" refused "no --actuate"; exit 3; }
  if [[ "$FM_MODE" == safety-critical && -z "${FM_OPERATOR:-}" ]]; then
    echo "REFUSED: safety-critical — set FM_OPERATOR=<human on board> (see .ai_context/safety.md)"; fm_result "$FM_ID" refused "no operator"; exit 3
  fi
}

# fm_open <url> — open in the default browser (only with --open).
fm_open() { command -v open >/dev/null && open "$1" || xdg-open "$1" 2>/dev/null || echo "Open: $1"; }
