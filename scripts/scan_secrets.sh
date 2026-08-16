#!/usr/bin/env bash
# SEC: fail if likely secrets would be committed.
# Run before first push and after any secret-touching change.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
note() { printf '%s\n' "$*"; }
bad() { printf 'FAIL: %s\n' "$*" >&2; fail=1; }

# Files that must never exist in the index / working tree for commit
forbidden_paths=(
  "homeassistant/secrets.yaml"
  "homeassistant/signalk/security.json"
  "signalk/security.json"
  "homeassistant/home-assistant_v2.db"
)

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    for p in "${forbidden_paths[@]}"; do
      if [[ "$f" == "$p" || "$f" == */"$p" ]]; then
        bad "tracked or staged forbidden path: $f"
      fi
    done
  done < <(git ls-files; git diff --cached --name-only 2>/dev/null || true)
fi

# Content patterns in tracked text (exclude example + docs placeholders)
# Only scan files that git would include
scan_list=()
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    # Case-insensitive: KiCad/vendor 3D assets ship as *.STEP as often as
    # *.step (multi-MB text-ish CAD, not worth grepping every commit).
    case "$f" in
      *secrets.yaml.example|*node_modules*|*archive/*) continue ;;
    esac
    shopt -s nocasematch
    case "$f" in
      *.pdf|*.png|*.jpg|*.step|*.wrl|*.zip) shopt -u nocasematch; continue ;;
    esac
    shopt -u nocasematch
    scan_list+=("$f")
  done < <(git ls-files)
else
  note "not a git repo yet — scanning common source trees only"
  while IFS= read -r f; do scan_list+=("$f"); done < <(
    find homeassistant/esphome homeassistant/packages homeassistant/dashboards \
         homeassistant/docs scripts .ai_context -type f \
         \( -name '*.yaml' -o -name '*.yml' -o -name '*.md' -o -name '*.sh' -o -name '*.py' \) \
         ! -path '*/.esphome/*' ! -path '*/node_modules/*' 2>/dev/null
  )
fi

# These two are allowed to hold a real local-only credential on disk
# (scripts/signalk-inject-mqtt-creds.sh, issue #74) — SK's plugin schemas
# have no !secret indirection, so the live file must hold a literal value
# for the running server to authenticate. What must never happen is that
# value reaching a commit, so these two are scanned via *staged* content
# (what `git commit` would actually record, i.e. the index) instead of the
# raw working-tree file — a local injection that was never `git add`ed
# can't fail this scan, but staging the real value still will. Everything
# else greps the working-tree file directly (fast, streamed — do not swap
# this for a buffered `content="$(cat "$f")"` + here-string for all files,
# it's fine for two small JSON files but was seconds-to-minutes slow
# against this repo's multi-MB KiCad *.STEP assets when tried).
local_secret_ok=(
  "homeassistant/signalk/plugin-config-data/signalk-mqtt-bridge.json"
  "homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json"
)

is_local_secret_ok() {
  local f="$1" p
  for p in "${local_secret_ok[@]}"; do
    [[ "$f" == "$p" ]] && return 0
  done
  return 1
}

grep_target() {
  # Runs a grep pipeline (passed as remaining args, ending in the pattern)
  # against the right source for $1: staged content for the two exempt
  # files, the working-tree file directly for everything else.
  local f="$1"; shift
  if is_local_secret_ok "$f"; then
    git show ":$f" 2>/dev/null | grep "$@"
  else
    grep "$@" "$f" 2>/dev/null
  fi
}

for f in "${scan_list[@]:-}"; do
  [[ -f "$f" ]] || continue
  # Inline ESPHome api/ota passwords that are not !secret
  if grep_target "$f" -nE 'password:\s*"[a-zA-Z0-9+/=]{12,}"' | grep -v CHANGE_ME >/dev/null; then
    bad "$f has inline password string (use !secret)"
    grep_target "$f" -nE 'password:\s*"[a-zA-Z0-9+/=]{12,}"' | grep -v CHANGE_ME || true
  fi
  if grep_target "$f" -nE 'key:\s*"[A-Za-z0-9+/=]{30,}"' | grep -v CHANGE_ME >/dev/null; then
    bad "$f has inline API encryption key (use !secret)"
    grep_target "$f" -nE 'key:\s*"[A-Za-z0-9+/=]{30,}"' | grep -v CHANGE_ME || true
  fi
  if grep_target "$f" -nE 'secretKey\s*:\s*"[a-f0-9]{32,}"' >/dev/null; then
    bad "$f contains Signal K secretKey"
  fi
  if grep_target "$f" -nEi 'ha_token:\s*"[^C][^"]{20,}"|Bearer [A-Za-z0-9._-]{20,}' >/dev/null; then
    bad "$f looks like a live HA/API token"
  fi
  # JSON-quoted password keys (e.g. Signal K plugin-config-data: "mqtt_password": "...")
  # — the YAML-style `password:\s*"` pattern above doesn't match `"password":` (closing
  # quote before the colon), so this needs its own pattern.
  if grep_target "$f" -nEi '"[A-Za-z_]*password"\s*:\s*"[^"]{8,}"' | grep -v CHANGE_ME >/dev/null; then
    bad "$f has a JSON-quoted password value committed (use scripts/signalk-inject-mqtt-creds.sh for local-only credentials instead)"
    grep_target "$f" -nEi '"[A-Za-z_]*password"\s*:\s*"[^"]{8,}"' | grep -v CHANGE_ME || true
  fi
  # Credentials embedded in a connection URL, e.g. mqtt://user:pass@host.
  # `{}` excluded from the password-char class so this doesn't fire on an
  # f-string/template placeholder like mqtt://{user}:{password}@{broker}
  # (real secrets don't contain literal braces) — found live in
  # scripts/signalk-inject-mqtt-creds.sh's own source (#74).
  if grep_target "$f" -nE '[a-z]+://[^/[:space:]"]+:[^/[:space:]@"{}]{8,}@' | grep -v CHANGE_ME >/dev/null; then
    bad "$f has credentials embedded in a URL (user:pass@host) committed"
    grep_target "$f" -nE '[a-z]+://[^/[:space:]"]+:[^/[:space:]@"{}]{8,}@' | grep -v CHANGE_ME || true
  fi
done

# secrets.yaml must not be readable by the scan as a commit candidate
if [[ -f homeassistant/secrets.yaml ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git check-ignore -q homeassistant/secrets.yaml; then
      note "OK: homeassistant/secrets.yaml is gitignored"
    else
      bad "homeassistant/secrets.yaml is NOT gitignored"
    fi
  fi
fi

# secrets.yaml.example must have exactly the same top-level keys as the real
# secrets.yaml — enforces the sync rule (CLAUDE.md rule 4 / secrets.md): any
# key added/removed/renamed in secrets.yaml must be mirrored the same change.
# Skipped gracefully if secrets.yaml doesn't exist locally (nothing to compare).
if [[ -f homeassistant/secrets.yaml && -f homeassistant/secrets.yaml.example ]]; then
  real_keys="$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*:' homeassistant/secrets.yaml | sort -u)"
  example_keys="$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*:' homeassistant/secrets.yaml.example | sort -u)"
  missing_from_example="$(comm -23 <(echo "$real_keys") <(echo "$example_keys"))"
  stale_in_example="$(comm -13 <(echo "$real_keys") <(echo "$example_keys"))"
  if [[ -n "$missing_from_example" || -n "$stale_in_example" ]]; then
    bad "secrets.yaml.example is out of sync with secrets.yaml"
    [[ -n "$missing_from_example" ]] && note "  in secrets.yaml but missing from example: $(echo "$missing_from_example" | tr '\n' ' ')"
    [[ -n "$stale_in_example" ]] && note "  in example but no longer in secrets.yaml (stale): $(echo "$stale_in_example" | tr '\n' ' ')"
    note "  add/remove the key in secrets.yaml.example (placeholder value + one-line comment, never a real value)"
  else
    note "OK: secrets.yaml.example keys match secrets.yaml"
  fi
fi

if [[ "$fail" -ne 0 ]]; then
  note "scan_secrets: FAILED"
  exit 1
fi
note "scan_secrets: OK"
exit 0
