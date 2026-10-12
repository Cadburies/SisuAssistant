#!/usr/bin/env bash
# End of task: post the verify summary, optionally close, always drop the claim label.
# Usage: ./scripts/release.sh N --as claude [--close] [--summary FILE]
#   FILE = the markdown verify.sh --summary wrote (key names only, never values).
exec python3 "$(dirname "$0")/_issue_lib.py" release "$@"
