#!/usr/bin/env python3
"""Render one branch of the Feature Map as a crew manual (#160). Reads .ai_context/feature_map only.

Usage: manual.py <folder> [--out FILE]      e.g. manual.py nav --out /tmp/sisu-nav-manual.md
Same crew filter as wiki.py: no script/Source/id, skips audience: agent, Needs up to " · ".
"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wiki import parse, cap, crew, order_key, needs_text, STATUS_NOTE  # one parser + crew filter for wiki and manual

ROOT = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--out")
    a = ap.parse_args()
    base = os.path.join(ROOT, a.folder)
    if not os.path.isdir(base):
        sys.exit(f"no such folder: {a.folder}")
    entries = []
    for d, _, fs in sorted(os.walk(base)):
        for f in sorted(fs, key=lambda x: (x != "index.md", x)):
            if f.endswith(".md"):
                fm, desc, b = parse(os.path.join(d, f))
                if fm.get("audience", "crew") != "agent":
                    entries.append((os.path.relpath(d, base), fm, desc, b))
    intro = next((e for e in entries if e[0] == "." and e[1]["id"] == a.folder), None)
    entries = [e for e in entries if e is not intro]
    entries.sort(key=lambda e: order_key(e[1]))  # UI order (#174), then title
    base_needs = intro[3].get("Needs", "").split(" · ")[0].strip().rstrip(".") if intro else ""
    title = intro[1]["title"].split(" › ")[0] if intro else a.folder
    anchor = lambda t: "".join(c for c in t.lower().replace(" ", "-") if c.isalnum() or c == "-")
    img = lambda fm: [f"![{fm['title']}]({os.path.join(ROOT, '_img', os.path.basename(fm['image']))})", ""] if fm.get("image") else []
    out = [f"# {title} — crew manual", "", crew(intro[2]) if intro else "", ""]
    if intro:
        out += img(intro[1])
        if base_needs: out += [f"**Before you start (everything below):** {cap(crew(base_needs))}", ""]
    out += ["## Contents", ""] + [f"- [{fm['title']}](#{anchor(fm['title'])})" for _, fm, _, _ in entries]
    for _, fm, desc, b in entries:
        note = STATUS_NOTE.get(fm.get("status", "live"), "")
        needs = needs_text(b, base_needs)
        out += ["", f"## {fm['title']}", "", crew(desc), ""] + img(fm) + ([f"> {note}", ""] if note else []) + [
            f"**How to get there:** {cap(crew(b.get('Reach', '')))}  ", f"**What it does:** {cap(crew(b.get('Action', '')))}  "]
        if needs: out += [f"**Before you start:** {cap(needs)}  "]
        out += [f"**What you should see:** {cap(crew(b.get('Expect', '')))}"]
    text = "\n".join(out) + "\n"
    if a.out:
        open(a.out, "w", encoding="utf-8").write(text)
        print(f"manual: {len(entries)} section(s) → {a.out}")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
