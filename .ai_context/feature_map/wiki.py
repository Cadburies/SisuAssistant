#!/usr/bin/env python3
"""Render the Feature Map (.ai_context/feature_map — the only source) into GitHub-wiki pages.

Usage: wiki.py --out <dir>      writes Home.md, _Sidebar.md, _Footer.md, one page per section
                                 folder and one page per feature; deletes stale *.md in <dir>.
Crew view only: drops script/Source/id; skips `audience: agent` features; in **Needs** only the
part before ` · ` is published (agent detail may follow the dot). Never edit the output by hand.
"""
import argparse, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SKIP = {"DESIGN.md", "TEMPLATE.md"}
TOP = {"net": "Network", "ha": "Home Assistant", "f8": "F8 server", "nav": "Sisu Nav",
       "esp": "ESPHome devices", "ext": "Third-party devices", "hw": "Marine Board hardware"}
ORDER = list(TOP)
STATUS_NOTE = {"planned": "🚧 Planned — not built yet.", "unverified": "⚠️ Not yet verified on board.",
               "broken": "❌ Known broken — see the issue tracker."}


def parse(path):
    lines = open(path, encoding="utf-8").read().splitlines()
    end = lines.index("---", 1)
    fm = dict(re.match(r"^(\w+):\s*(.*)$", l).groups() for l in lines[1:end] if ":" in l)
    body = [l for l in lines[end + 1:] if l.strip()]
    bullets = {m[1]: m[2].strip() for m in (re.match(r"^- \*\*(\w+):\*\*\s*(.*)$", b) for b in body) if m}
    desc = next((l for l in body if not l.startswith("-")), "")
    return fm, desc, bullets


def cap(t):
    return t[:1].upper() + t[1:] if t else t


def slug(text):
    s = re.sub(r"[^\w\s-]", " ", text.replace("›", " "))
    return re.sub(r"\s+", "-", s.strip())


def folder_name(rel):
    parts = rel.split("/")
    if len(parts) == 1:
        return TOP.get(parts[0], parts[0].replace("-", " ").title())
    return parts[-1].replace("-", " ").title()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    out = ap.parse_args().out
    os.makedirs(out, exist_ok=True)

    features, folders = [], {}
    for d, _, fs in os.walk(ROOT):
        rel_d = os.path.relpath(d, ROOT)
        if rel_d.startswith((".", "_")) and rel_d != ".":
            continue
        for f in fs:
            if not f.endswith(".md") or (rel_d == "." and f in SKIP):
                continue
            fm, desc, b = parse(os.path.join(d, f))
            if fm.get("audience", "crew") == "agent":
                continue
            rel = "" if rel_d == "." else rel_d
            if f == "index.md":
                folders[rel] = (fm, desc)
            else:
                features.append((rel, fm, desc, b))

    # section pages for every folder that holds a published feature
    sections = {}
    for rel, *_ in features:
        parts = rel.split("/")
        for i in range(1, len(parts) + 1):
            sections.setdefault("/".join(parts[:i]), [])
    for rel, fm, desc, b in features:
        sections[rel].append((fm, desc))

    def section_title(rel):
        return folders[rel][0]["title"] if rel in folders else " › ".join(folder_name("/".join(rel.split("/")[:i + 1])) for i in range(len(rel.split("/"))))

    def crumbs(rel):
        parts = rel.split("/")
        links = ["[Home](Home)"] + [f"[{folder_name('/'.join(parts[:i + 1]))}]({slug(section_title('/'.join(parts[:i + 1])))})" for i in range(len(parts))]
        return " › ".join(links)

    pages = {}
    for rel, fm, desc, b in features:
        needs = b.get("Needs", "").split(" · ")[0]
        note = STATUS_NOTE.get(fm.get("status", "live"), "")
        body = [f"{crumbs(rel)}", "", f"# {fm['title']}", "", desc, ""]
        if note: body += [f"> {note}", ""]
        body += ["## How to get there", cap(b.get("Reach", "")), "", "## What it does", cap(b.get("Action", "")), "",
                 "## Before you start", cap(needs), "", "## What you should see", cap(b.get("Expect", "")), ""]
        pages[slug(fm["title"])] = "\n".join(body)

    for rel, items in sections.items():
        subs = sorted(s for s in sections if s.startswith(rel + "/") and s.count("/") == rel.count("/") + 1)
        lines = [crumbs(rel) if "/" in rel else "[Home](Home)", "", f"# {section_title(rel)}", ""]
        if rel in folders: lines += [folders[rel][1], ""]
        lines += [f"- **[{folder_name(s)}]({slug(section_title(s))})**" for s in subs]
        lines += [f"- [{fm['title']}]({slug(fm['title'])}) — {desc}" for fm, desc in sorted(items, key=lambda x: x[0]["title"])]
        pages[slug(section_title(rel))] = "\n".join(lines) + "\n"

    def tree(prefix, depth):
        rows = []
        for s in sorted(k for k in sections if (k.count("/") == depth and (k.startswith(prefix + "/") if prefix else True))):
            rows.append("  " * depth + f"- [{folder_name(s)}]({slug(section_title(s))})")
            rows += tree(s, depth + 1)
        return rows

    tops = sorted([s for s in sections if "/" not in s], key=lambda s: ORDER.index(s) if s in ORDER else 99)
    side = ["**[Home](Home)**", ""]
    for t in tops:
        side.append(f"- [{folder_name(t)}]({slug(section_title(t))})")
        side += tree(t, 1)
    pages["_Sidebar"] = "\n".join(side) + "\n"
    pages["Home"] = "\n".join(["# Sisu Assistant — feature guide", "",
        "Every screen, button and page of the Sisu Assistant system: where it is, how to get there, "
        "what it does and what you should see. Use the search box above or the sidebar.", ""]
        + [f"- **[{folder_name(t)}]({slug(section_title(t))})**" for t in tops]) + "\n"
    pages["_Footer"] = ("_Generated from `.ai_context/feature_map/` in the SisuAssistant repo — "
                        "do not edit here; change the feature file and the wiki regenerates._\n")

    for f in os.listdir(out):
        if f.endswith(".md") and f[:-3] not in pages:
            os.remove(os.path.join(out, f))
    for name, text in pages.items():
        with open(os.path.join(out, name + ".md"), "w", encoding="utf-8") as fh:
            fh.write(text)
    print(f"wiki: {len(features)} feature page(s), {len(sections)} section page(s) → {out}")


if __name__ == "__main__":
    sys.exit(main())
