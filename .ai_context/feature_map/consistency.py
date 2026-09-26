#!/usr/bin/env python3
"""Feature Map consistency / broken-link check (#159) — source ↔ map, not format (that is lint.sh).

Usage: consistency.py [--offline]
  1. every HA dashboard registered in configuration.yaml is named in some feature's Source
  2. every dashboard `navigation_path` targets a registered dashboard
  3. every entity a dashboard shows exists in HA (live REST; skipped with --offline or when HA is unreachable)
  4. every sisu-nav plugin folder and every /api/<family> in server.mjs is covered by a feature file
  5. every ESPHome device entry YAML is named in some feature's Source
Prints one line per finding; exit 1 if any.
"""
import glob, json, os, re, sys, urllib.request

FM = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(FM, "..", ".."))
MAP_TEXT = "\n".join(open(p, encoding="utf-8").read() for p in glob.glob(os.path.join(FM, "**", "*.md"), recursive=True)
                     if os.path.basename(p) not in ("DESIGN.md", "TEMPLATE.md"))
SOURCES = "\n".join(l for l in MAP_TEXT.splitlines() if l.startswith("- **Source:**"))
findings = []


def rd(rel):
    return open(os.path.join(REPO, rel), encoding="utf-8").read()


def secret(key):
    m = re.search(rf"^{key}:\s*\"?([^\"\n]+)\"?", rd("homeassistant/secrets.yaml"), re.M)
    return m.group(1).strip() if m else ""


# 1–2 dashboards and navigation targets
conf = rd("homeassistant/configuration.yaml")
dash = dict(re.findall(r"^\s{4}(lovelace[\w-]*):\s*\n(?:\s{6}.*\n)*?\s{6}filename:\s*(\S+)", conf, re.M))
dash_files = ["homeassistant/" + f for f in dash.values()]
for f in dash_files:
    if f not in SOURCES:
        findings.append(f"dashboard not documented: {f} (no feature Source names it)")
for f in dash_files:
    for target in re.findall(r"navigation_path:\s*['\"]?(/[\w-]+)", rd(f)):
        if target.lstrip("/").split("/")[0] not in dash:
            findings.append(f"dead navigation_path {target} in {f}")

# 3 entities shown by dashboards exist in HA
if "--offline" not in sys.argv:
    try:
        req = urllib.request.Request(f"http://{secret('ha_host')}:8123/api/states",
                                     headers={"Authorization": f"Bearer {secret('ha_token')}"})
        live = {s["entity_id"] for s in json.load(urllib.request.urlopen(req, timeout=10))}
        dom = r"(?:sensor|binary_sensor|switch|number|select|text_sensor|input_\w+|button|camera|climate|weather|device_tracker|automation|update)"
        for f in dash_files:
            for e in sorted(set(re.findall(rf"\b({dom}\.[a-z0-9_]+[a-z0-9])\b", rd(f)))):
                if e not in live:
                    findings.append(f"unknown entity {e} in {f}")
    except Exception as ex:  # off-vessel: not a finding
        print(f"(skip entity check: HA unreachable — {ex.__class__.__name__})")

# 4 Sisu Nav plugins and API route families
for d in sorted(glob.glob(os.path.join(REPO, "sisu-nav/web/src/plugins/*/"))):
    name = os.path.basename(d.rstrip("/"))
    if not re.search(rf"plugins/(?:\{{[^}}]*\b{re.escape(name)}\b[^}}]*\}}|{re.escape(name)}/)", MAP_TEXT):
        findings.append(f"sisu-nav plugin not documented: {name}")
for fam in sorted(set(re.findall(r"['\"]/api/([a-z][\w-]*)", rd("sisu-nav/api/server.mjs")))):
    if f"/api/{fam}" not in MAP_TEXT and f"api/{fam}/" not in MAP_TEXT:
        findings.append(f"sisu-nav API family not documented: /api/{fam}")

# 5 ESPHome device entries
for f in sorted(glob.glob(os.path.join(REPO, "homeassistant/esphome/*.yaml"))):
    rel = os.path.relpath(f, REPO)
    if os.path.basename(f) == "secrets.yaml":
        continue
    if rel not in SOURCES and os.path.basename(f) not in SOURCES:
        findings.append(f"ESPHome device not documented: {rel}")

print("\n".join(findings) if findings else "consistency OK")
sys.exit(1 if findings else 0)
