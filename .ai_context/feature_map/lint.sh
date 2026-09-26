#!/usr/bin/env bash
# Feature Map lint — every <feature>.md matches TEMPLATE.md and its <feature>.sh is sane.
# Usage: lint.sh [folder…]   (folders relative to .ai_context/feature_map; default: whole map)
# Exit 0 = clean, 1 = problems (one line each: <file>: <problem>).
cd "$(dirname "$0")" && exec python3 - "$@" <<'PY'
import os, re, sys
ROOT = os.getcwd()
REPO = os.path.normpath(os.path.join(ROOT, "..", ".."))
SKIP = {"DESIGN.md", "TEMPLATE.md"}
TOOLS = {"TEMPLATE.sh", "_lib.sh", "lint.sh", "check.sh", "wiki.sh", "who-uses.sh"}
KEYS = ["title", "id", "kind", "tags", "status", "script"]
OPTIONAL = {"audience": {"crew", "agent"}}   # audience: agent = not published to the wiki
KINDS = set("root network host app service dashboard view card chip control panel layer setting route device page flow hardware".split())
STATUS = {"live", "planned", "unverified", "broken"}
BULLETS = ["Reach", "Action", "Needs", "Expect", "Source"]
MODES = {"read", "actuate", "safety-critical"}
CEIL = re.compile(r"ALT_I_CEIL|ALT_T_CEIL|HOUSE_V_CEIL|ceil|hard.?limit", re.I)
MAX_LINES = 25

targets = sys.argv[1:] or ["."]
problems, ids, md_scripts = [], {}, set()
def bad(path, msg): problems.append(f"{path}: {msg}")

def walk(t):
    base = os.path.normpath(os.path.join(ROOT, t))
    if not os.path.isdir(base):
        bad(t, "folder not found"); return []
    out = []
    for d, _, files in os.walk(base):
        out += [os.path.join(d, f) for f in files]
    return out

files = sorted({f for t in targets for f in walk(t)})
for f in files:
    rel = os.path.relpath(f, ROOT)
    name = os.path.basename(f)
    if not rel.endswith(".md") or (os.path.dirname(rel) == "" and name in SKIP):
        continue
    lines = open(f, encoding="utf-8").read().splitlines()
    if len(lines) > MAX_LINES: bad(rel, f"{len(lines)} lines (max {MAX_LINES}) — split the feature")
    if not lines or lines[0] != "---":
        bad(rel, "missing front matter"); continue
    try: end = lines.index("---", 1)
    except ValueError: bad(rel, "front matter not closed"); continue
    fm = {}
    for ln in lines[1:end]:
        m = re.match(r"^(\w+):\s*(.*)$", ln)
        if not m: bad(rel, f"front matter line not 'key: value': {ln!r}"); continue
        fm[m[1]] = m[2].strip()
    for k in KEYS:
        if not fm.get(k): bad(rel, f"front matter '{k}' missing or empty")
    for k, allowed in OPTIONAL.items():
        if k in fm and fm[k] not in allowed: bad(rel, f"{k} '{fm[k]}' not in {sorted(allowed)}")
    extra = set(fm) - set(KEYS) - set(OPTIONAL)
    if extra: bad(rel, f"unknown front matter keys: {sorted(extra)}")
    want_id = rel[:-3] if name != "index.md" else os.path.dirname(rel)
    if fm.get("id") and fm["id"] != want_id: bad(rel, f"id '{fm['id']}' != path '{want_id}'")
    if fm.get("id") in ids: bad(rel, f"duplicate id (also {ids[fm['id']]})")
    ids[fm.get("id")] = rel
    if fm.get("kind") and fm["kind"] not in KINDS: bad(rel, f"kind '{fm['kind']}' not in vocabulary")
    if fm.get("status") and fm["status"] not in STATUS: bad(rel, f"status '{fm['status']}' not in {sorted(STATUS)}")

    body = [l for l in lines[end + 1:] if l.strip()]
    if not body or body[0].startswith("-"): bad(rel, "body must start with one description sentence")
    bullets = [l for l in body if l.lstrip().startswith("-")]
    got = [ (re.match(r"^- \*\*(\w+):\*\*", b) or [None, None])[1] for b in bullets ]
    if got != BULLETS: bad(rel, f"bullets must be exactly {BULLETS} in order, got {got}")
    if len(body) != 1 + len(bullets): bad(rel, "only one sentence + the 5 bullets allowed in the body")

    # Source is the parallel-work contract: every path it names must exist (who-uses.sh relies on it).
    src = next((b for b in bullets if b.startswith("- **Source:**")), "")
    for tok in re.findall(r"`([^`]+)`", src):
        path = tok.split(" (")[0].split(" §")[0].strip()
        if "/" not in path or "{" in path or path.startswith(("http", "sisu/", "/")) or " " in path:
            continue
        if not os.path.exists(os.path.join(REPO, path)):
            bad(rel, f"Source path not found: {path}")

    sc = fm.get("script")
    if sc:
        sp = os.path.join(os.path.dirname(f), sc)
        md_scripts.add(os.path.normpath(sp))
        if os.path.splitext(sc)[0] != os.path.splitext(name)[0] and name != "index.md":
            bad(rel, f"script '{sc}' must share the basename of the .md")
        if not os.path.isfile(sp): bad(rel, f"script '{sc}' not found beside it"); continue
        if not os.access(sp, os.X_OK): bad(rel, f"script '{sc}' not executable (chmod +x)")
        src = open(sp, encoding="utf-8").read()
        m = re.search(r"^FM_ID=(\S+)", src, re.M)
        if not m or m[1] != fm.get("id"): bad(rel, f"script FM_ID {m[1] if m else None!r} != id {fm.get('id')!r}")
        mm = re.search(r"^FM_MODE=(\S+)", src, re.M)
        mode = mm[1] if mm else "read"
        if mode not in MODES: bad(rel, f"script FM_MODE '{mode}' not in {sorted(MODES)}")
        if mode != "read" and not re.search(r"^\s*fm_gate\b", src, re.M):
            bad(rel, f"script is FM_MODE={mode} but never calls fm_gate")
        if mode != "read" and CEIL.search(src):
            bad(rel, "hard-ceiling name in a non-read script (CLAUDE.md rule 2: ceilings are read-only here)")

for f in files:
    rel = os.path.relpath(f, ROOT)
    if rel.endswith(".sh") and os.path.basename(f) not in TOOLS and os.path.normpath(f) not in md_scripts:
        bad(rel, "orphan script (no .md names it)")

print("\n".join(problems) if problems else f"lint OK — {len(ids)} feature file(s)")
sys.exit(1 if problems else 0)
PY
