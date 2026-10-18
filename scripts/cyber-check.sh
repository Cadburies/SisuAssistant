#!/usr/bin/env bash
# Cyber-attack sweep (#205). Procedure: skills/cyber-check/SKILL.md. Logic: scripts/cyber_check.py.
#
# Usage:
#   ./scripts/cyber-check.sh                full sweep (npm audit, pip-audit, gitleaks history, GitHub)
#   ./scripts/cyber-check.sh --quick        offline subset (no network, no history)
#   ./scripts/cyber-check.sh --stale [DAYS] exit 1 if the last full sweep is older than DAYS (default 7)
#
# Report: ~/.sisu-cyber-check/report-*.md (outside the repo, mode 600, never publish it).
# Exit: 0 nothing HIGH/MED · 1 a HIGH finding · 2 MED only · 3 clean but a check could not run.
set -uo pipefail
exec python3 "$(cd "$(dirname "$0")" && pwd)/cyber_check.py" "$@"
