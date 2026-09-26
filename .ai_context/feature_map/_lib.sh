# Feature Map shared helpers — sourced by every <feature>.sh. Read-only by default.
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
