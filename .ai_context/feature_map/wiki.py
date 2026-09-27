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


def crew(t):
    """Crew wording: drop issue references (#NNN) that help agents but are noise for crew (#174)."""
    t = re.sub(r"\s*(?:Known issue|Tracked in|Currently broken[^.]*?)\s*#\d+[^.]*\.?", "", t)
    t = re.sub(r"\s*\((?:[^()]*?\b)?(?:see |e\.g\. )?#\d+(?:[/,]\s*#\d+)*\)", "", t)
    t = re.sub(r"\s*(?:—|-)?\s*see #\d+", "", t)
    t = re.sub(r"\s*#\d+\b", "", t)
    return re.sub(r"\s{2,}", " ", t).replace(" .", ".").strip()


def order_key(fm):
    """Optional `order:` front matter = UI order within a folder; untagged sort after, by title (#174)."""
    try:
        return (int(fm.get("order", 999)), fm.get("title", ""))
    except ValueError:
        return (999, fm.get("title", ""))


def needs_text(b, parent_needs=""):
    """Crew part of Needs; empty when it only repeats the section's own Needs (#174)."""
    n = b.get("Needs", "").split(" · ")[0].strip().rstrip(".")
    if parent_needs and n.startswith(parent_needs):
        n = n[len(parent_needs):].lstrip(" ;,")
        n = ("Also: " + n) if n else ""
    return crew(n)


REPO = os.path.normpath(os.path.join(ROOT, "..", ".."))


def images(fm):
    """`image:` = comma-separated list; a bare name lives in _img/, a path is repo-relative
    (e.g. MarineBoard/Documentation/PWM (new).png — pointer, not a copy). Returns (src, url-safe name)."""
    out = []
    for raw in (fm.get("image") or "").split(","):
        raw = raw.strip()
        if not raw:
            continue
        src = os.path.join(REPO, raw) if "/" in raw else os.path.join(ROOT, "_img", raw)
        stem, ext = os.path.splitext(os.path.basename(raw))
        safe = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-") + ext.lower()
        out.append((src, safe))
    return out


def image_md(fm, prefix=""):
    return "\n\n".join(f"![{fm['title']}]({prefix}_img/{safe})" for _, safe in images(fm))


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
                folders[rel] = (fm, desc, b)
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

    def label(rel):
        return folders[rel][0]["title"].split(" › ")[0] if rel in folders else folder_name(rel)

    def section_title(rel):
        return folders[rel][0]["title"] if rel in folders else " › ".join(folder_name("/".join(rel.split("/")[:i + 1])) for i in range(len(rel.split("/"))))

    def crumbs(rel):
        parts = rel.split("/")
        links = ["[Home](Home)"] + [f"[{label('/'.join(parts[:i + 1]))}]({slug(section_title('/'.join(parts[:i + 1])))})" for i in range(len(parts))]
        return " › ".join(links)

    pages = {}
    for rel, fm, desc, b in features:
        parent = folders.get(rel)
        needs = needs_text(b, parent[2].get("Needs", "").split(" · ")[0].strip().rstrip(".") if parent else "")
        note = STATUS_NOTE.get(fm.get("status", "live"), "")
        body = [f"{crumbs(rel)}", "", f"# {fm['title']}", "", crew(desc), ""]
        if image_md(fm): body += [image_md(fm), ""]
        if note: body += [f"> {note}", ""]
        body += ["## How to get there", cap(crew(b.get("Reach", ""))), "", "## What it does", cap(crew(b.get("Action", ""))), ""]
        if needs: body += ["## Before you start", cap(needs), ""]
        body += ["## What you should see", cap(crew(b.get("Expect", ""))), ""]
        pages[slug(fm["title"])] = "\n".join(body)

    for rel, items in sections.items():
        subs = sorted(s for s in sections if s.startswith(rel + "/") and s.count("/") == rel.count("/") + 1)
        lines = [crumbs(rel) if "/" in rel else "[Home](Home)", "", f"# {section_title(rel)}", ""]
        if rel in folders:
            lines += [crew(folders[rel][1]), ""]
            if image_md(folders[rel][0]): lines += [image_md(folders[rel][0]), ""]
            fn = needs_text(folders[rel][2])
            if fn: lines += [f"**Before you start:** {cap(fn)}", ""]
        lines += [f"- **[{label(s)}]({slug(section_title(s))})**" for s in subs]
        lines += [f"- [{fm['title']}]({slug(fm['title'])}) — {crew(desc)}" for fm, desc in sorted(items, key=lambda x: order_key(x[0]))]
        pages[slug(section_title(rel))] = "\n".join(lines) + "\n"

    def tree(prefix, depth):
        rows = []
        for s in sorted(k for k in sections if (k.count("/") == depth and (k.startswith(prefix + "/") if prefix else True))):
            rows.append("  " * depth + f"- [{label(s)}]({slug(section_title(s))})")
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

    os.makedirs(os.path.join(out, "_img"), exist_ok=True)
    for fm in [f[1] for f in features] + [v[0] for v in folders.values()]:
        for src, safe in images(fm):
            with open(src, "rb") as a, open(os.path.join(out, "_img", safe), "wb") as z:
                z.write(a.read())
    for f in os.listdir(out):
        if f.endswith(".md") and f[:-3] not in pages:
            os.remove(os.path.join(out, f))
    for name, text in pages.items():
        with open(os.path.join(out, name + ".md"), "w", encoding="utf-8") as fh:
            fh.write(text)
    print(f"wiki: {len(features)} feature page(s), {len(sections)} section page(s) → {out}")


if __name__ == "__main__":
    sys.exit(main())
