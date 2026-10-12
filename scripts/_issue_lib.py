#!/usr/bin/env python3
"""GitHub-issue side of the agent task loop (CLAUDE.md §Gates / §Parallel agents, #195).

Called by scripts/next-issue.sh, claim.sh, release.sh and verify.sh --issue.
The hotspot and bad-pair tables below are the authority; CLAUDE.md only explains why.

  _issue_lib.py touches N            print N's Touches paths, one per line
  _issue_lib.py drift N FILE...      print FILEs that are outside N's Touches
  _issue_lib.py next [--all]         ranked workable issues (claim.sh still runs the parallel-safety check)
  _issue_lib.py claim N --as AGENT [--dry-run]
  _issue_lib.py release N --as AGENT [--close] [--summary FILE]
"""
import argparse, fnmatch, json, os, re, subprocess, sys

# At most one claimed issue may list each of these (CLAUDE.md §Parallel agents).
HOTSPOTS = [
    "homeassistant/esphome/packages/marine_alternator.yaml",
    "homeassistant/esphome/packages/marine_board_base.yaml",
    "homeassistant/automations.yaml",
    "homeassistant/configuration.yaml",
    "homeassistant/docker-compose.yml",
    "homeassistant/docs/ALTERNATOR_LIMITS.md",
    "homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json",
    ".ai_context/naming.md",
    ".ai_context/safety.md",
    "scripts/ha-*.sh",
    "scripts/scan_secrets.sh",
    "NETWORK.md",
    "OPS.md",
]

# Never in the same wave, even when the paths are disjoint. "*" = anything.
# (Production OTA ∥ hard-ceiling edits is an action, not a path: still a human call.)
BAD_PAIRS = [
    ("alternator firmware ∥ alternator dashboard/limits",
     ["homeassistant/esphome/packages/marine_alternator.yaml", "homeassistant/esphome/alternator*.yaml"],
     ["homeassistant/dashboards/alternators.yaml", "homeassistant/docs/ALTERNATOR_LIMITS.md"]),
    ("MQTT automations ∥ Signal K plugin map",
     ["homeassistant/automations.yaml"],
     ["homeassistant/signalk/plugin-config-data/signalk-mqtt-sensors.json"]),
    ("freezer YAML ∥ secrets example keys",
     ["homeassistant/esphome/freezer*.yaml"],
     ["homeassistant/secrets.yaml.example"]),
    ("anything ∥ .gitignore / secrets policy",
     [".gitignore", "**/.gitignore", ".ai_context/secrets.md"],
     ["*"]),
]

PRIORITY = {"P1": 1, "P2": 2, "P3": 3}
GATED = {"needs-human", "historical"}


def gh(*args, parse=True):
    out = subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout
    return json.loads(out) if parse else out


def issue(n):
    return gh("issue", "view", str(n), "--json", "number,title,state,labels,body")


def labels(i):
    return {l["name"] for l in i.get("labels", [])}


def section(body, name):
    m = re.search(rf"^##\s+{name}\s*$(.*?)(?=^##\s|\Z)", body or "", re.M | re.S)
    return re.sub(r"<!--.*?-->", "", m.group(1), flags=re.S) if m else ""


def touches(body):
    """Paths from the Touches section: every `backticked` token that looks like a path,
    else the first word of each bullet."""
    paths = []
    for line in section(body, "Touches").splitlines():
        line = line.strip()
        if not line.startswith(("-", "*")):
            continue
        ticks = re.findall(r"`([^`]+)`", line)
        rest = line.lstrip("-* ").split()
        cand = ticks or rest[:1]
        for c in cand:
            c = c.strip().rstrip(",")
            if "/" in c or "." in c:
                paths.append(c)
    return paths


def norm(p):
    return p.strip().removeprefix("./").rstrip("/")


def overlap(a, b):
    a, b = norm(a), norm(b)
    if a == "*" or b == "*" or a == b:
        return True
    if fnmatch.fnmatch(a, b) or fnmatch.fnmatch(b, a):
        return True
    return a.startswith(b + "/") or b.startswith(a + "/")


def any_overlap(xs, ys):
    return [(x, y) for x in xs for y in ys if overlap(x, y)]


def depends(body):
    return sorted({int(n) for n in re.findall(r"Depends on #(\d+)", body or "", re.I)})


def unresolved_deps(body):
    return [n for n in depends(body) if issue(n)["state"] == "OPEN"]


def claimed(exclude=None):
    out = gh("issue", "list", "--state", "open", "--limit", "200", "--json", "number,title,labels,body")
    return [i for i in out if i["number"] != exclude and any(l.startswith("agent:") for l in labels(i))]


def conflicts(mine, others):
    """Reasons `mine` (paths) cannot run beside the claimed issues `others`."""
    why = []
    for o in others:
        theirs = touches(o["body"])
        tag = f"#{o['number']} ({', '.join(sorted(l for l in labels(o) if l.startswith('agent:')))})"
        for x, y in any_overlap(mine, theirs):
            why.append(f"Touches overlap with {tag}: {x} ~ {y}")
        for h in HOTSPOTS:
            if any_overlap(mine, [h]) and any_overlap(theirs, [h]):
                why.append(f"hotspot {h} already owned by {tag}")
        for name, left, right in BAD_PAIRS:
            if (any_overlap(mine, left) and any_overlap(theirs, right)) or \
               (any_overlap(mine, right) and any_overlap(theirs, left)):
                why.append(f"bad pair '{name}' with {tag}")
    return sorted(set(why))


def cmd_touches(a):
    print("\n".join(touches(issue(a.n)["body"])))


def cmd_drift(a):
    t = touches(issue(a.n)["body"])
    for f in a.files:
        if not any(overlap(f, p) for p in t):
            print(f)


def cmd_next(a):
    out = gh("issue", "list", "--state", "open", "--limit", "200", "--json", "number,title,labels,body")
    rows = []
    for i in out:
        ls, why = labels(i), []
        if any(l.startswith("agent:") for l in ls):
            why.append("claimed")
        if ls & GATED:
            why.append("needs-human")
        if not touches(i["body"]):
            why.append("no Touches")
        deps = unresolved_deps(i["body"]) if not why else []
        if deps:
            why.append("depends on " + ",".join(f"#{d}" for d in deps))
        pri = min((PRIORITY[l] for l in ls if l in PRIORITY), default=9)
        rows.append((pri, i["number"], i["title"], why))
    rows.sort()
    for pri, n, title, why in rows:
        if why and not a.all:
            continue
        print(f"#{n}\tP{pri if pri < 9 else '?'}\t{title}" + (f"\t[skip: {'; '.join(why)}]" if why else ""))


def cmd_claim(a):
    i = issue(a.n)
    ls = labels(i)
    if i["state"] != "OPEN":
        sys.exit(f"#{a.n} is {i['state']}")
    if any(l.startswith("agent:") for l in ls):
        sys.exit(f"#{a.n} already claimed: {sorted(l for l in ls if l.startswith('agent:'))}")
    mine = touches(i["body"])
    if not mine:
        sys.exit(f"#{a.n} has no concrete Touches — fix the issue body first (skills/file-issue/SKILL.md)")
    vague = [p for p in mine if "/" not in p and not os.path.exists(p)]
    if vague:
        print(f"warn: #{a.n} Touches entries are not full repo paths: {vague} — hotspot/bad-pair checks only match full paths", file=sys.stderr)
    deps = unresolved_deps(i["body"])
    if deps:
        sys.exit(f"#{a.n} depends on open " + ", ".join(f"#{d}" for d in deps))
    others = claimed(exclude=a.n)
    why = conflicts(mine, others)
    if why:
        sys.exit("not parallel-safe:\n  " + "\n  ".join(why))
    own_hot = [h for h in HOTSPOTS if any_overlap(mine, [h])]
    reason = (f"no overlap / hotspot / bad pair vs {len(others)} open claim(s)"
              + (f" ({', '.join('#' + str(o['number']) for o in others)})" if others else "")
              + (f"; owns hotspot(s) {', '.join(own_hot)}" if own_hot else ""))
    if a.dry_run:
        print(f"dry-run OK: {reason}")
        return
    gh("issue", "edit", str(a.n), "--add-label", f"agent:{a.agent}", parse=False)
    gh("issue", "comment", str(a.n), "--body", f"Claimed by {a.agent}. Parallel-safe: {reason}.", parse=False)
    print(f"claimed #{a.n} as agent:{a.agent} — {reason}")


def cmd_release(a):
    if a.summary:
        gh("issue", "comment", str(a.n), "--body-file", a.summary, parse=False)
    if a.close:
        gh("issue", "close", str(a.n), parse=False)
    gh("issue", "edit", str(a.n), "--remove-label", f"agent:{a.agent}", parse=False)
    print(f"released #{a.n}" + (" (closed)" if a.close else ""))


def main():
    p = argparse.ArgumentParser()
    s = p.add_subparsers(dest="cmd", required=True)
    x = s.add_parser("touches"); x.add_argument("n", type=int); x.set_defaults(f=cmd_touches)
    x = s.add_parser("drift"); x.add_argument("n", type=int); x.add_argument("files", nargs="*"); x.set_defaults(f=cmd_drift)
    x = s.add_parser("next"); x.add_argument("--all", action="store_true"); x.set_defaults(f=cmd_next)
    x = s.add_parser("claim"); x.add_argument("n", type=int); x.add_argument("--as", dest="agent", required=True)
    x.add_argument("--dry-run", action="store_true"); x.set_defaults(f=cmd_claim)
    x = s.add_parser("release"); x.add_argument("n", type=int); x.add_argument("--as", dest="agent", required=True)
    x.add_argument("--close", action="store_true"); x.add_argument("--summary"); x.set_defaults(f=cmd_release)
    a = p.parse_args()
    os.chdir(subprocess.run(["git", "rev-parse", "--show-toplevel"], check=True,
                            capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__))).stdout.strip())
    a.f(a)


if __name__ == "__main__":
    main()
