#!/usr/bin/env bash
# CLAUDE.md §Gates verify map as code (#195): changed paths -> the checks they need.
#
# Usage:
#   ./scripts/verify.sh [--since REF | --staged] [--issue N] [--live] [--summary FILE] [PATH...]
#     PATH...        verify exactly these files (preferred in a shared tree)
#     --since REF    files changed vs REF, committed or not, plus untracked (default: @{u}, else HEAD)
#     --staged       staged files only
#     --all          every tracked file (CI backstop, .github/workflows/verify.yml)
#     --issue N      also warn on files outside issue N's Touches
#     --live         read-only vessel probes (HA API, dashboard entities, stack drift, Sisu Nav)
#     --summary FILE write a markdown result for the issue comment (release.sh --summary)
#   ./scripts/verify.sh --guard-commit MSGFILE   (.githooks/commit-msg) refuse a staged
#     hard-ceiling change unless the message has a "Human-Approved: <why>" trailer.
#
# Exit: 0 green · 1 a check failed · 3 green, but a box deploy is still pending.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Mandatory rule 2 constants: any +/- line naming one needs human approval.
CEILINGS='ALT_I_CEIL|ALT_T_CEIL|HOUSE_V_CEIL'
CEILING_FILE=homeassistant/esphome/packages/marine_alternator.yaml

if [[ "${1:-}" == "--guard-commit" ]]; then
  if git diff --cached -U0 -- "$CEILING_FILE" | grep -E '^[+-][^+-]' | grep -qE "$CEILINGS"; then
    grep -qiE '^Human-Approved: *[^ ]' "$2" && exit 0
    echo "commit-msg: hard ceiling ($CEILINGS) changed in $CEILING_FILE." >&2
    echo "  Mandatory rule 2: add a 'Human-Approved: <who/why>' trailer once the human has approved," >&2
    echo "  and update homeassistant/docs/ALTERNATOR_LIMITS.md in the same commit." >&2
    exit 1
  fi
  exit 0
fi

since="" staged=0 issue="" live=0 summary="" files=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --since) since="$2"; shift 2 ;;
    --staged) staged=1; shift ;;
    --all) while IFS= read -r f; do files+=("$f"); done < <(git ls-files); shift ;;
    --issue) issue="$2"; shift 2 ;;
    --live) live=1; shift ;;
    --summary) summary="$2"; shift 2 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) files+=("$1"); shift ;;
  esac
done

if [[ ${#files[@]} -eq 0 ]]; then
  if [[ $staged -eq 1 ]]; then
    while IFS= read -r f; do files+=("$f"); done < <(git diff --cached --name-only)
  else
    [[ -z "$since" ]] && { since="$(git rev-parse --abbrev-ref '@{u}' 2>/dev/null || echo HEAD)"; }
    while IFS= read -r f; do files+=("$f"); done < <(git diff --name-only "$since"; git ls-files --others --exclude-standard)
  fi
fi

results=() pending=() warns=() fail=0
ok()   { results+=("- ✅ $1"); echo "ok    $1"; }
bad()  { results+=("- ❌ $1"); echo "FAIL  $1" >&2; fail=1; }
skip() { results+=("- ⏭️ $1"); echo "skip  $1"; }
warn() { warns+=("- ⚠️ $1"); echo "warn  $1"; }
run()  { # run "label" cmd...  (quiet unless it fails)
  local label="$1"; shift; local out
  if out="$("$@" 2>&1)"; then ok "$label"; else bad "$label"; printf '%s\n' "$out" | tail -25 >&2; fi
}
has() { local p; for p in "${files[@]}"; do [[ "$p" == $1 ]] && return 0; done; return 1; }
matching() { local p; for p in "${files[@]}"; do [[ "$p" == $1 ]] && [[ -e "$p" ]] && echo "$p"; done; }

echo "verify: ${#files[@]} changed file(s)${since:+ vs $since}"

# 1. Secrets — every commit.
run "scan_secrets.sh" ./scripts/scan_secrets.sh
if [[ ${#files[@]} -eq 0 ]]; then
  echo "verify: no changed files — secrets only"
  [[ -n "$summary" ]] && printf '### Verify (%s)\n%s\n\n_No changed files: secrets scan only._\n' "$(git rev-parse --short HEAD)" "${results[*]}" > "$summary"
  [[ $fail -eq 0 ]] && exit 0 || exit 1
fi

# 2. ESPHome — changed entries, plus every entry that !includes a changed package.
entries=()
for f in "${files[@]}"; do
  case "$f" in
    homeassistant/esphome/packages/*.yaml)
      while IFS= read -r e; do entries+=("$e"); done < <(
        grep -lE "!include +packages/$(basename "$f")" homeassistant/esphome/*.yaml) ;;
    homeassistant/esphome/secrets.yaml) ;;
    homeassistant/esphome/*.yaml) [[ -f "$f" && "$f" != */archive/* ]] && entries+=("$f") ;;
  esac
done
if [[ ${#entries[@]} -gt 0 ]]; then
  if command -v esphome >/dev/null; then
    for e in $(printf '%s\n' "${entries[@]}" | sort -u); do run "esphome config $e" esphome config "$e"; done
  else skip "esphome config (esphome not installed)"; fi
fi

# 3. Hard ceilings — never silently.
if has "$CEILING_FILE" && git diff -U0 "${since:-HEAD}" -- "$CEILING_FILE" 2>/dev/null \
     | grep -E '^[+-][^+-]' | grep -qE "$CEILINGS"; then
  warn "hard ceiling line changed in $CEILING_FILE — needs human approval + Human-Approved: trailer (rule 2)"
fi

# 4. Compose / Signal K / Mosquitto -> F8 topology.
if has 'homeassistant/docker-compose*.yml' || has 'homeassistant/signalk/*' || has 'homeassistant/mosquitto/*'; then
  if command -v docker >/dev/null; then
    run "docker compose config" docker compose -f homeassistant/docker-compose.yml config -q
  else skip "docker compose config (docker not installed)"; fi
fi
for j in $(matching 'homeassistant/signalk/*.json'); do run "json $j" python3 -m json.tool "$j"; done

# 5. HA YAML — parse (HA tags like !include/!secret accepted, not resolved).
ha_yaml=$(matching 'homeassistant/*.yaml'; matching 'homeassistant/packages/*.yaml'; matching 'homeassistant/dashboards/*.yaml')
ha_yaml=$(printf '%s\n' $ha_yaml | grep -v -e secrets.yaml -e '^homeassistant/esphome/' | sort -u)
if [[ -n "$ha_yaml" ]]; then
  # shellcheck disable=SC2086
  run "HA YAML parse ($(echo $ha_yaml | wc -w | tr -d ' ') file(s))" python3 - $ha_yaml <<'PY'
import sys, yaml
class L(yaml.SafeLoader): pass
L.add_multi_constructor("!", lambda l, s, n: None)
for f in sys.argv[1:]:
    yaml.load(open(f), Loader=L)
PY
fi
for p in $(matching 'homeassistant/python_scripts/*.py'); do run "py_compile $p" python3 -m py_compile "$p"; done

# 6. Sisu Nav.
if has 'sisu-nav/web/*'; then
  if [[ -d sisu-nav/web/node_modules ]]; then run "sisu-nav/web tsc --noEmit" npm --prefix sisu-nav/web exec -- tsc --noEmit -p sisu-nav/web
  else skip "sisu-nav/web tsc (no node_modules — npm ci in sisu-nav/web)"; fi
fi
for m in $(matching 'sisu-nav/api/*.mjs'); do run "node --check $m" node --check "$m"; done

# 7. Feature Map.
has '.ai_context/feature_map/*' && run "feature_map lint.sh" .ai_context/feature_map/lint.sh

# 8. Touches drift.
if [[ -n "$issue" ]]; then
  while IFS= read -r f; do [[ -n "$f" ]] && warn "outside #$issue Touches: $f"; done < <(
    python3 scripts/_issue_lib.py drift "$issue" "${files[@]}")
fi

# 9. What git push does NOT make live (CLAUDE.md §Gates "Done means", rule 12).
haos=$(printf '%s\n' "${files[@]}" | grep -E '^homeassistant/((configuration|automations|scripts|scenes|ui-lovelace|secrets)\.yaml$|(packages|python_scripts|dashboards|themes|www)/)' || true)
[[ -n "$haos" ]] && pending+=("HA Green: \`./scripts/ha-deploy-config.sh $(echo $haos)\` then \`./scripts/ha-cli.sh core check\` (+ reload/restart)")
f8=$(printf '%s\n' "${files[@]}" | grep -E '^(sisu-nav/|homeassistant/(signalk|grafana|grafana-provisioning|mosquitto|influx-tasks)/|homeassistant/docker-compose\.yml)' || true)
[[ -n "$f8" ]] && pending+=("F8: \`./scripts/f8-deploy.sh\` (+ \`docker compose up -d\` for changed services)")
[[ ${#entries[@]} -gt 0 ]] && pending+=("ESPHome OTA for $(printf '%s\n' "${entries[@]}" | sort -u | xargs -n1 basename | tr '\n' ' ')— production engine-room boards need human review first")

# 10. Live probes (read-only).
if [[ $live -eq 1 ]]; then
  host="$(awk -F': *' '$1=="ha_ssh_host"{gsub(/["'\'']/,"",$2);print $2;exit}' homeassistant/secrets.yaml 2>/dev/null)"; host="${host:-192.168.0.20}"
  if curl -s -m 4 -o /dev/null "http://$host:8123/"; then
    dash=$(matching 'homeassistant/dashboards/*.yaml'; matching 'homeassistant/ui-lovelace.yaml')
    if [[ -n "$dash" ]]; then
      # shellcheck disable=SC2086
      run "dashboard entities exist on HA Green" python3 - "$host" $dash <<'PY'
import json, re, sys, urllib.request
host, files = sys.argv[1], sys.argv[2:]
tok = next((l.split(":", 1)[1].strip().strip("'\"") for l in open("homeassistant/secrets.yaml")
            if l.startswith("ha_token:")), "")
req = urllib.request.Request(f"http://{host}:8123/api/states", headers={"Authorization": f"Bearer {tok}"})
live = {s["entity_id"] for s in json.load(urllib.request.urlopen(req, timeout=10))}
doms = "sensor|binary_sensor|switch|number|select|button|input_boolean|input_number|input_select|input_text|input_datetime|text_sensor|climate|light|camera|automation|script|counter|timer|weather|sun|zone|person|device_tracker|update|text|lock|cover|fan|media_player|event|valve|water_heater|image"
missing = sorted({e for f in files for e in re.findall(rf"\b(?:{doms})\.[a-z0-9_]+\b", open(f).read())} - live)
for e in missing: print("missing", e)
sys.exit(1 if missing else 0)
PY
    fi
    [[ -n "$haos" ]] && { ./scripts/stack-drift.sh green >/dev/null 2>&1; rc=$?
      case $rc in 0) ok "stack-drift green in sync";; 2) skip "stack-drift green (unreachable)";; *) warn "stack-drift green: drift (deploy pending or box-side edit)";; esac; }
  else skip "live HA Green probes ($host unreachable)"; fi
  if [[ -n "$f8" ]]; then
    if curl -s -m 4 -o /dev/null -w '%{http_code}' http://192.168.0.21:8088/api/health | grep -q 200; then ok "Sisu Nav /api/health 200"
    else skip "Sisu Nav /api/health (F8 unreachable or down)"; fi
    ./scripts/stack-drift.sh f8 >/dev/null 2>&1; rc=$?
    case $rc in 0) ok "stack-drift f8 in sync";; 2) skip "stack-drift f8 (unreachable)";; *) warn "stack-drift f8: drift (deploy pending or box-side edit)";; esac
  fi
fi

# Report.
for p in "${pending[@]+"${pending[@]}"}"; do echo "TODO  $p"; done
if [[ -n "$summary" ]]; then
  {
    echo "### Verify ($(git rev-parse --short HEAD))"
    printf '%s\n' "${results[@]+"${results[@]}"}" "${warns[@]+"${warns[@]}"}"
    [[ ${#pending[@]} -gt 0 ]] && { echo; echo "**Deploy pending:**"; printf -- '- %s\n' "${pending[@]}"; }
    echo; echo "_Files: ${#files[@]} · \`scripts/verify.sh\`_"
  } > "$summary"
fi
[[ $fail -ne 0 ]] && { echo "verify: RED"; exit 1; }
[[ ${#pending[@]} -gt 0 ]] && { echo "verify: green — deploy pending (exit 3)"; exit 3; }
echo "verify: green"
