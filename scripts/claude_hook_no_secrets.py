#!/usr/bin/env python3
"""Claude Code PreToolUse hook (Bash): refuse a command that would publish a secret.

Blocks (exit 2) when the command text - or any file it posts with
--body-file / -F / --input (gh issue/pr/api/release/gist ...) - contains a real
secret value from the local stores (scripts/secret_values.py). Issue and PR text
is public on this repo and has no git hook in front of it (#175).
Only key names are reported, never values.
"""
import json, os, re, shlex, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import secret_values  # noqa: E402


def main():
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return 0
    cmd = (event.get("tool_input") or {}).get("command") or ""
    if not cmd:
        return 0
    vals, _ = secret_values.load()
    if not vals:
        return 0
    texts = [("command", cmd)]
    try:
        words = shlex.split(cmd, posix=True)
    except ValueError:
        words = cmd.split()
    cwd = event.get("cwd") or os.getcwd()
    for i, w in enumerate(words):
        path = None
        if w in ("--body-file", "-F", "--input", "--notes-file") and i + 1 < len(words):
            path = words[i + 1]
        elif re.match(r"--(body-file|input|notes-file)=", w):
            path = w.split("=", 1)[1]
        if path and path != "-":
            p = path if os.path.isabs(path) else os.path.join(cwd, path)
            if os.path.isfile(p):
                texts.append((path, open(p, "rb").read()))
    found = []
    for where, t in texts:
        found += [f"{k} in {where}" for k in secret_values.find(t, vals)]
    if found:
        print("Blocked: this command would expose a real secret value (#175): " + "; ".join(found)
              + ". Redact it (e.g. ***REMOVED***) or reference the key name instead.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
