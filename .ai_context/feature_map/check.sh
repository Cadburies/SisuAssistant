#!/usr/bin/env bash
# Feature Map check — run every feature script (read mode: no --actuate is ever passed) and tabulate.
# Usage: check.sh [folder…]   (default: whole map). Exit 1 if any script reports 'unexpected'.
cd "$(dirname "$0")" && exec python3 - "$@" <<'PY'
import json, os, re, subprocess, sys
ROOT = os.getcwd()
rows = []
for t in sys.argv[1:] or ["."]:
    for d, _, fs in sorted(os.walk(os.path.join(ROOT, t))):
        for f in sorted(fs):
            if not f.endswith(".md") or (os.path.normpath(d) == ROOT and f in ("DESIGN.md", "TEMPLATE.md")): continue
            m = re.search(r"^script:\s*(\S+)", open(os.path.join(d, f)).read(), re.M)
            if not m: continue
            sp = os.path.join(d, m[1])
            try:
                p = subprocess.run(["bash", sp], capture_output=True, text=True, timeout=90)
                last = (p.stdout.strip().splitlines() or ["{}"])[-1]
                r = json.loads(last) if last.startswith("{") else {}
                rows.append((os.path.relpath(sp, ROOT), p.returncode, r.get("result", "no-json"), r.get("observed", last[:60])))
            except subprocess.TimeoutExpired:
                rows.append((os.path.relpath(sp, ROOT), "-", "timeout", ">90 s"))
w = max([len(r[0]) for r in rows] + [6])
print(f"{'script':<{w}}  exit  result      observed")
for r in rows: print(f"{r[0]:<{w}}  {str(r[1]):<4}  {r[2]:<10}  {r[3]}")
counts = {k: sum(1 for r in rows if r[2] == k) for k in ("ok", "unexpected", "skip", "refused", "timeout", "no-json")}
print("  ".join(f"{k}={v}" for k, v in counts.items() if v) or "no scripts")
sys.exit(1 if counts["unexpected"] or counts["timeout"] or counts["no-json"] else 0)
PY
