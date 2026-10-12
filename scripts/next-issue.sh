#!/usr/bin/env bash
# Ranked workable issues (skills/do-issue, CLAUDE.md §Gates): skips agent:*, needs-human, no Touches,
# unresolved "Depends on #N"; P1 > P2 > P3, lowest number first. First line = candidate; claim.sh decides.
# Usage: ./scripts/next-issue.sh [--all]   (--all also lists skipped issues + why)
exec python3 "$(dirname "$0")/_issue_lib.py" next "$@"
