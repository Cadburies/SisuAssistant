#!/usr/bin/env bash
# Publish the Feature Map to the GitHub wiki (Cadburies/SisuAssistant.wiki). Source of truth stays
# .ai_context/feature_map/ — the wiki is generated output, never edited by hand.
# Usage: wiki.sh [--dry-run]   (--dry-run: generate into the local wiki clone, show the diff, don't push)
# Runs automatically on push to main via .github/workflows/feature-map-wiki.yml; this is the local path.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WIKI_DIR="${FM_WIKI_DIR:-$HOME/.cache/sisu-assistant-wiki}"
WIKI_URL="https://github.com/Cadburies/SisuAssistant.wiki.git"

"$HERE/lint.sh" >/dev/null || { "$HERE/lint.sh"; echo "wiki: lint failed — fix the feature files first"; exit 1; }
if [[ -d "$WIKI_DIR/.git" ]]; then git -C "$WIKI_DIR" pull -q --ff-only
else git clone -q "$WIKI_URL" "$WIKI_DIR" || { echo "wiki: clone failed — enable the wiki and create its first page once in the GitHub UI"; exit 2; }; fi

python3 "$HERE/wiki.py" --out "$WIKI_DIR"
cd "$WIKI_DIR"
git add -A
if git diff --cached --quiet; then echo "wiki: already up to date"; exit 0; fi
git diff --cached --stat
[[ "${1:-}" == "--dry-run" ]] && { git reset -q; echo "wiki: dry run — nothing pushed"; exit 0; }
git -c user.name="Feature Map" -c user.email="10117942+Cadburies@users.noreply.github.com" \
  commit -q -m "Regenerate from feature_map @ $(git -C "$HERE" rev-parse --short HEAD)"
git push -q && echo "wiki: pushed"
