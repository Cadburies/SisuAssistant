#!/usr/bin/env python3
"""
Generate the Quilter high-current nets CSV from the KiCad net classes.

Source of truth is MarineBoard.kicad_pro (net classes + patterns). Class names
encode the rating as <ROLE>_<Vmax>_<Amps>, e.g. FIELD_15V_10A, RAIL_3V3_1A5
(1A5 = 1.5 A). Every net matched by a class that carries an amp rating is
written out; SW_* (switch nodes) and GATE_* get use_power_pour=false so the
router keeps that copper compact.

Also cross-checks the patterns against the schematic netlist (via kicad-cli)
so a renamed net can't silently drop out of its class.

Usage: python3 quilter_nets.py [-o production/quilter_high_current_nets.csv]
"""

import argparse
import csv
import fnmatch
import json
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
PRO = HERE / "MarineBoard.kicad_pro"
SCH = HERE / "MarineBoard.kicad_sch"
KICAD_CLI = "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"
NO_POUR_PREFIXES = ("SW_", "GATE_")


def class_amps(name: str):
    m = re.search(r"_(\d+)A(\d*)$", name)
    if not m:
        return None
    return float(f"{m.group(1)}.{m.group(2) or 0}")


def schematic_nets() -> set:
    cli = KICAD_CLI if Path(KICAD_CLI).exists() else "kicad-cli"
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "net.xml"
        subprocess.run([cli, "sch", "export", "netlist", "--format", "kicadxml",
                        "-o", str(out), str(SCH)], check=True, capture_output=True)
        return {n.get("name") for n in ET.parse(out).getroot().iter("net")}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", default=str(HERE / "production" / "quilter_high_current_nets.csv"))
    args = ap.parse_args()

    ns = json.loads(PRO.read_text())["net_settings"]
    prio = {c["name"]: c.get("priority", 1 << 31) for c in ns["classes"]}
    nets = schematic_nets()

    assigned = {}  # net -> class (highest priority = lowest number wins, as in KiCad)
    ok = True
    for p in ns.get("netclass_patterns") or []:
        hits = [n for n in nets if fnmatch.fnmatchcase(n, p["pattern"])]
        if not hits:
            print(f"WARNING: pattern {p['pattern']!r} ({p['netclass']}) matches no schematic net", file=sys.stderr)
            ok = False
        for n in hits:
            if n not in assigned or prio[p["netclass"]] < prio[assigned[n]]:
                assigned[n] = p["netclass"]

    rows = []
    for net, cls in assigned.items():
        amps = class_amps(cls)
        if amps is None:
            continue
        pour = not cls.startswith(NO_POUR_PREFIXES)
        rows.append((prio[cls], net, int(round(amps * 1000)), "true" if pour else "false"))
    rows.sort(key=lambda r: (r[0], r[1]))

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["net_name", "max_current", "use_power_pour"])
        for _, net, ma, pour in rows:
            w.writerow([net, ma, pour])
    print(f"Wrote {len(rows)} nets to {out}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
