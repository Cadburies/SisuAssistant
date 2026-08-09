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
