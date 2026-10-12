#!/usr/bin/env bash
# Claim an issue only if it is parallel-safe vs every open claim: no Touches
# overlap, no hotspot already owned, no bad pair (tables: scripts/_issue_lib.py).
# Usage: ./scripts/claim.sh N --as claude [--dry-run]
exec python3 "$(dirname "$0")/_issue_lib.py" claim "$@"
