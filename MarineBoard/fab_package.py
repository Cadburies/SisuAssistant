#!/usr/bin/env python3
"""Build the PCBWay fab + assembly package into production/ from the KiCad project.

    python3 fab_package.py            # KiCad must be closed (reads the saved files)

Wipes production/ (except the Quilter net-class CSV, a routing input), then writes:
  gerbers/ + MarineBoard-PCBWay-Gerbers.zip   4 copper, mask, paste, silk, outline,
                                               PTH/NPTH Excellon + maps, IPC-D-356 netlist
  MarineBoard-BOM.csv / .xlsx                 grouped BOM + LOOSE items (xlsx = PCBWay upload)
  MarineBoard-positions.csv / .xlsx           centroid (xlsx = PCBWay upload)

Refills zones first; aborts if DRC (errors only, with schematic parity) is not clean.
"""
import csv, os, re, shutil, subprocess, sys, zipfile
import openpyxl
from openpyxl.styles import Font

KICAD_CLI = os.environ.get("KICAD_CLI", "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli")
HERE = os.path.dirname(os.path.abspath(__file__))
PCB = os.path.join(HERE, "MarineBoard.kicad_pcb")
SCH = os.path.join(HERE, "MarineBoard.kicad_sch")
OUT = os.path.join(HERE, "production")
GERB = os.path.join(OUT, "gerbers")
KEEP = {"quilter_high_current_nets.csv"}
LAYERS = "F.Cu,In1.Cu,In2.Cu,B.Cu,F.Paste,B.Paste,F.SilkS,B.SilkS,F.Mask,B.Mask,Edge.Cuts"

# Supplied loose with the boards, not mounted (spare blade fuses for the XF-506P holders, JP1 shunt).
LOOSE = [
    ("F1-FUSE", "2A", "0297002.WXNV", "LOOSE - MINI blade fuse 2A 32V for holder F1 (XF-506P)", "Littelfuse", 1),
    ("F2-FUSE", "1A", "0297001.WXNV", "LOOSE - MINI blade fuse 1A 32V for holder F2 (XF-506P)", "Littelfuse", 1),
    ("F3-FUSE,F4-FUSE", "10A", "0297010.WXNV", "LOOSE - MINI blade fuse 10A 32V for holders F3, F4 (XF-506P)", "Littelfuse", 2),
    ("JP1-SHUNT", "Jumper 1.27mm", "", "LOOSE - 2-pin 1.27 mm pitch jumper shunt for JP1 (CAN termination; leave JP1 open)", "", 1),
]
INSTRUCTIONS = {"JP1": "Leave open - supply shunt loose"}


def cli(*args):
    r = subprocess.run([KICAD_CLI, *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"kicad-cli {' '.join(args[:3])} failed:\n{r.stdout}{r.stderr}")
    return r.stdout


def drc_gate():
    rpt = os.path.join(OUT, ".drc.rpt")
    subprocess.run([KICAD_CLI, "pcb", "drc", "--schematic-parity", "--refill-zones", "--save-board",
                    "--severity-error", "-o", rpt, PCB], capture_output=True)
    text = open(rpt).read()
    os.remove(rpt)
    counts = [int(n) for n in re.findall(r"\*\* Found (\d+)", text)]
    if any(counts):
        sys.exit("DRC errors - fix before building the fab package:\n" + text)


def footprint_info():
    """ref -> (side, 'SMD'|'THT') from the saved board."""
    t = open(PCB).read()
    info = {}
    for m in re.finditer(r'\n\t\(footprint "[^"]+"\n(.*?)\n\t\)', t, re.S):
        body = m.group(1)
        ref = re.search(r'\(property "Reference" "([^"]+)"', body).group(1)
        side = "Top" if re.search(r'\(layer "([^"]+)"\)', body).group(1) == "F.Cu" else "Bottom"
        attr = re.search(r"\(attr ([^)]*)\)", body)
        kind = "THT" if attr and "through_hole" in attr.group(1) else "SMD"
        info[ref] = (side, kind)
    return info


def fmt_sheet(ws, widths):
    for c in ws[1]:
        c.font = Font(bold=True)
    ws.freeze_panes = "A2"
    for col, w in widths.items():
        ws.column_dimensions[col].width = w


def main():
    os.makedirs(OUT, exist_ok=True)
    for name in os.listdir(OUT):
        if name in KEEP:
            continue
        p = os.path.join(OUT, name)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    drc_gate()

    os.makedirs(GERB)
    cli("pcb", "export", "gerbers", "-l", LAYERS, "-o", GERB + "/", PCB)
    cli("pcb", "export", "drill", "--format", "excellon", "--excellon-separate-th", "--excellon-units", "mm",
        "--generate-map", "--map-format", "gerberx2", "-o", GERB + "/", PCB)
    cli("pcb", "export", "ipcd356", "-o", os.path.join(GERB, "MarineBoard-netlist.ipc"), PCB)
    with zipfile.ZipFile(os.path.join(OUT, "MarineBoard-PCBWay-Gerbers.zip"), "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(GERB)):
            z.write(os.path.join(GERB, f), f)

    # BOM
    bom_csv = os.path.join(OUT, "MarineBoard-BOM.csv")
    cli("sch", "export", "bom", "--exclude-dnp",
        "--fields", "Reference,Value,Footprint,${QUANTITY},MPN,Description,Manufacturer",
        "--labels", "Refs,Value,Footprint,Qty,MPN,Description,Manufacturer",
        "--group-by", "Value,Footprint,MPN", "--sort-field", "Reference", "--ref-range-delimiter", "",
        "-o", bom_csv, SCH)
    with open(bom_csv, "a", newline="") as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        for refs, val, mpn, desc, mfr, qty in LOOSE:
            w.writerow([refs, val, "LOOSE - do not mount", qty, mpn, desc, mfr])

    fps = footprint_info()
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "BOM"
    ws.append(["Item #", "Designator", "Qty", "Manufacturer", "Mfg Part # / LCSC", "Description", "Value",
               "Package", "Type", "Side", "Instructions"])
    for i, r in enumerate(csv.DictReader(open(bom_csv)), 1):
        refs = r["Refs"].split(",")
        if r["Footprint"].startswith("LOOSE"):
            ws.append([i, r["Refs"], int(r["Qty"]), r["Manufacturer"] or None, r["MPN"] or None, r["Description"],
                       r["Value"], None, "LOOSE", None, "Supply loose - do NOT mount"])
            continue
        missing = [x for x in refs if x not in fps]
        if missing:
            sys.exit(f"BOM refs not on the board: {missing}")
        sides = sorted({fps[x][0] for x in refs})
        kinds = {fps[x][1] for x in refs}
        ws.append([i, r["Refs"], int(r["Qty"]), r["Manufacturer"] or None, r["MPN"] or None, r["Description"] or None,
                   r["Value"], r["Footprint"].split(":")[-1], "THT" if kinds == {"THT"} else "SMD", "/".join(sides),
                   next((INSTRUCTIONS[x] for x in refs if x in INSTRUCTIONS), None)])
    fmt_sheet(ws, {"A": 7, "B": 26, "C": 5, "D": 16, "E": 20, "F": 60, "G": 22, "H": 34, "I": 7, "J": 11, "K": 30})
    wb.save(os.path.join(OUT, "MarineBoard-BOM.xlsx"))

    # Centroid
    pos_csv = os.path.join(OUT, "MarineBoard-positions.csv")
    cli("pcb", "export", "pos", "--format", "csv", "--units", "mm", "--side", "both", "--exclude-dnp", "-o", pos_csv, PCB)
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Centroid"
    ws.append(["Designator", "Value", "Package", "Mid X (mm)", "Mid Y (mm)", "Rotation", "Layer"])
    for r in csv.DictReader(open(pos_csv)):
        ws.append([r["Ref"], r["Val"], r["Package"], float(r["PosX"]), float(r["PosY"]), float(r["Rot"]),
                   r["Side"].capitalize()])
    fmt_sheet(ws, {"A": 12, "B": 24, "C": 34, "D": 12, "E": 12, "F": 10, "G": 8})
    wb.save(os.path.join(OUT, "MarineBoard-positions.xlsx"))

    print("production/:", ", ".join(sorted(os.listdir(OUT))))
    print("gerbers/:", ", ".join(sorted(os.listdir(GERB))))


if __name__ == "__main__":
    main()
