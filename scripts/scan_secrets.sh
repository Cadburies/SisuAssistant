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
    case "$f" in
      *secrets.yaml.example|*node_modules*|*archive/*|*.pdf|*.png|*.jpg|*.step|*.wrl|*.zip) continue ;;
    esac
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

for f in "${scan_list[@]:-}"; do
  [[ -f "$f" ]] || continue
  # Inline ESPHome api/ota passwords that are not !secret
  if grep -nE 'password:\s*"[a-zA-Z0-9+/=]{12,}"' "$f" 2>/dev/null | grep -v CHANGE_ME >/dev/null; then
    bad "$f has inline password string (use !secret)"
    grep -nE 'password:\s*"[a-zA-Z0-9+/=]{12,}"' "$f" | grep -v CHANGE_ME || true
  fi
  if grep -nE 'key:\s*"[A-Za-z0-9+/=]{30,}"' "$f" 2>/dev/null | grep -v CHANGE_ME >/dev/null; then
    bad "$f has inline API encryption key (use !secret)"
    grep -nE 'key:\s*"[A-Za-z0-9+/=]{30,}"' "$f" | grep -v CHANGE_ME || true
  fi
  if grep -nE 'secretKey\s*:\s*"[a-f0-9]{32,}"' "$f" 2>/dev/null >/dev/null; then
    bad "$f contains Signal K secretKey"
  fi
  if grep -nEi 'ha_token:\s*"[^C][^"]{20,}"|Bearer [A-Za-z0-9._-]{20,}' "$f" 2>/dev/null >/dev/null; then
    bad "$f looks like a live HA/API token"
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

if [[ "$fail" -ne 0 ]]; then
  note "scan_secrets: FAILED"
  exit 1
fi
note "scan_secrets: OK"
exit 0
