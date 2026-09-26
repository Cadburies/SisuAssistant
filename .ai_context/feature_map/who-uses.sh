#!/usr/bin/env bash
# Which feature files depend on a source path? Run before claiming/editing that path (put the result in
# the issue's Touches) and update the listed feature files in the same change (CLAUDE.md self-heal).
# Usage: who-uses.sh <repo-relative path or fragment>    e.g. who-uses.sh homeassistant/dashboards/helm.yaml
set -euo pipefail
[[ $# -eq 1 ]] || { echo "usage: $0 <path>"; exit 2; }
cd "$(dirname "$0")"
grep -rl --include='*.md' -e "^- \*\*Source:\*\*.*$1" . | sed 's#^\./##' | sort | while read -r f; do
  printf '%-45s %s\n' "$f" "$(sed -n 's/^title: //p' "$f")"
done
