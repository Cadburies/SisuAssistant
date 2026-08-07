#!/usr/bin/env python3
"""
Full Self-Contained LCSC → KiCad Importer
- Smart placeholder upgrade for footprint & 3D model
- Detailed logging showing what is backed up, added, or upgraded
"""

import argparse
import csv
import re
import shutil
import sys
import time
from pathlib import Path
from typing import List, Optional, Dict

import requests

# Colors
GRN = "\033[92m"
RED = "\033[91m"
YLW = "\033[93m"
BLU = "\033[94m"
RST = "\033[0m"


def print_progress(msg: str, color: str = GRN, level: str = "INFO") -> None:
    ts = time.strftime("%H:%M:%S")
    print(f"{BLU}[{ts}]{RST} {color}{level}: {msg}{RST}")


def ensure_libraries(lib_path: Path) -> None:
    lib_path.mkdir(parents=True, exist_ok=True)
    (lib_path / "EasyEDA.kicad_sym").touch(exist_ok=True)
    (lib_path / "EasyEDA.pretty").mkdir(exist_ok=True)
    (lib_path / "EasyEDA.3dshapes").mkdir(exist_ok=True)
    print_progress(f"EasyEDA libraries ready at {lib_path}", GRN)


def create_backup(lib_path: Path, lcsc: str) -> Path:
    backup_path = lib_path / "backup"
    backup_path.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    sub = backup_path / ts
    sub.mkdir(exist_ok=True)
    print_progress(
        f"Backing up EasyEDA libraries before modifying {lcsc}", YLW, "BACKUP"
    )

    backed_up = []
    for item in list(lib_path.glob("EasyEDA.*")) + list(lib_path.rglob("EasyEDA/*")):
        if item.is_file():
            dest = sub / item.relative_to(lib_path)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, dest)
            backed_up.append(item.name)

    if backed_up:
        print_progress(
            f"Backed up files: {', '.join(backed_up[:8])}{'...' if len(backed_up) > 8 else ''}",
            YLW,
        )
    return sub


def parse_kicad_bom(bom_path: Path) -> List[str]:
    parts: List[str] = []
    try:
        with bom_path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                return parts
            headers = [h.strip().lower() for h in reader.fieldnames]
            lcsc_col = next((h for h in headers if "lcsc" in h), None)
            if not lcsc_col:
                return parts
            for row in reader:
                val = str(row.get(lcsc_col, "")).strip()
                if val.startswith("C") and val[1:].isdigit():
                    parts.append(val)
    except Exception as e:
        print_progress(f"BOM parse error: {e}", YLW, "WARN")
    return parts


def download_and_save(url: str, filepath: Path) -> bool:
    """Download file and save it. Returns True on success."""
    if not url or not isinstance(url, str) or not url.startswith("http"):
        return False
    try:
        r = requests.get(url, timeout=20)
        if r.status_code == 200 and len(r.content) > 100:
            filepath.write_bytes(r.content)
            return True
    except Exception:
        pass
    return False


def fetch_lcsc_component(lcsc: str) -> Optional[Dict]:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; LCSC-KiCad-Importer/3.3)"}
    urls = [
        f"https://wwwapi.lcsc.com/v1/search/global-search?keyword={lcsc}",
        f"https://www.lcsc.com/api/products/search?search_content={lcsc}&current_page=1&page_size=1",
    ]

    for url in urls:
        try:
            r = requests.get(url, headers=headers, timeout=12)
            if r.status_code != 200:
                continue
            resp = r.json()
            items = resp.get("data", {}).get("items") or resp.get("data") or []
            if not isinstance(items, list):
                items = [items] if isinstance(items, dict) else []
            for item in items:
                code = str(item.get("productCode") or item.get("lcsc") or "").upper()
                if code == lcsc.upper():
                    print_progress(
                        f"Found {lcsc} on LCSC → {item.get('productModel', 'Unknown')}",
                        GRN,
                    )
                    return item
        except Exception:
            continue

    print_progress(
        f"Could not fetch detailed data for {lcsc} — using minimal info", YLW, "WARN"
    )
    return {
        "productCode": lcsc,
        "title": lcsc,
        "description": "LCSC component",
        "manufacturerName": "Unknown",
    }


def import_full_part(lib_path: Path, lcsc: str, data: Dict) -> bool:
    # === SYMBOL (always update) ===
    fields = {
        "Manufacturer": data.get("manufacturerName") or data.get("brand") or "Unknown",
        "MPN": data.get("productModel") or data.get("mpn") or lcsc,
        "Package": data.get("package") or data.get("encapsulation") or "Unknown",
        "Description": data.get("description") or data.get("title") or "Unknown",
        "Datasheet": data.get("pdfUrl")
        or data.get("dataSheetUrl")
        or f"https://www.lcsc.com/datasheet/{lcsc}.pdf",
        "LCSC Part": lcsc,
    }

    sym_file = lib_path / "EasyEDA.kicad_sym"
    content = (
        sym_file.read_text(encoding="utf-8")
        if sym_file.exists()
        else '(kicad_symbol_lib (version 20211014) (generator "lcsc-importer"))\n'
    )

    existed = f'"{lcsc}"' in content or f"LCSC_{lcsc}" in content
    action = "Updating" if existed else "Adding new"
    print_progress(f"{action} symbol with PCBWay fields in EasyEDA.kicad_sym", GRN)

    field_order = [
        "Manufacturer",
        "MPN",
        "Package",
        "Description",
        "Datasheet",
        "LCSC Part",
    ]
    field_props = []
    for i, fname in enumerate(field_order):
        value = fields[fname].replace('"', '\\"')
        y_pos = i * -1.27
        field_props.append(
            f'    (property "{fname}" "{value}" (at 0 {y_pos} 0) (effects (font (size 1.27 1.27)) (hide yes)))'
        )

    symbol_name = f"LCSC_{lcsc}"
    new_symbol = (
        f"""(symbol "{symbol_name}" (in_bom yes) (on_board yes)
  (property "Reference" "U" (at 0 0 0) (effects (font (size 1.27 1.27))))
  (property "Value" "{lcsc}" (at 0 -1.27 0) (effects (font (size 1.27 1.27))))
"""
        + "\n".join(field_props)
        + "\n)\n"
    )

    if existed:
        content = re.sub(
            r'(symbol "[^"]*?' + re.escape(lcsc) + r".*?)\)",
            new_symbol.rstrip() + ")",
            content,
            flags=re.DOTALL | re.IGNORECASE,
        )
    else:
        content = content.rstrip() + "\n" + new_symbol

    sym_file.write_text(content, encoding="utf-8")

    # === FOOTPRINT - Smart upgrade ===
    fp_file = lib_path / "EasyEDA.pretty" / f"{lcsc}.kicad_mod"
    fp_url = data.get("footprintUrl") or data.get("footprint") or None

    if fp_file.exists():
        size = fp_file.stat().st_size
        if size < 500:  # small placeholder
            print_progress(
                f"Small placeholder footprint detected for {lcsc} → attempting upgrade",
                YLW,
            )
            if download_and_save(fp_url, fp_file):
                print_progress(
                    f"✅ Replaced placeholder with real footprint: {lcsc}.kicad_mod",
                    GRN,
                )
            else:
                print_progress(
                    f"Could not download footprint — keeping placeholder", YLW
                )
        else:
            print_progress(
                f"Footprint {lcsc}.kicad_mod already exists and appears modified (kept)",
                YLW,
            )
    else:
        if download_and_save(fp_url, fp_file):
            print_progress(f"✅ Downloaded real footprint for {lcsc}", GRN)
        else:
            fp_file.write_text(
                f"(module {lcsc} (layer F.Cu) (tedit 0))\n", encoding="utf-8"
            )
            print_progress(f"Created placeholder footprint {lcsc}.kicad_mod", YLW)

    # === 3D MODEL - Smart upgrade ===
    wrl_file = lib_path / "EasyEDA.3dshapes" / f"{lcsc}.wrl"
    model_url = (
        data.get("3dModelUrl") or data.get("model3d") or data.get("model") or None
    )

    if wrl_file.exists():
        size = wrl_file.stat().st_size
        if size < 200:  # tiny placeholder
            print_progress(
                f"Small placeholder 3D model detected for {lcsc} → attempting upgrade",
                YLW,
            )
            if download_and_save(model_url, wrl_file):
                print_progress(
                    f"✅ Replaced placeholder with real 3D model: {lcsc}.wrl", GRN
                )
            else:
                print_progress(
                    f"Could not download 3D model — keeping placeholder", YLW
                )
        else:
            print_progress(
                f"3D model {lcsc}.wrl already exists and appears modified (kept)", YLW
            )
    else:
        if download_and_save(model_url, wrl_file):
            print_progress(f"✅ Downloaded real 3D model for {lcsc}", GRN)
        else:
            wrl_file.write_text(
                "#VRML V2.0 utf8\n# Placeholder for " + lcsc + "\n", encoding="utf-8"
            )
            print_progress(f"Created placeholder 3D model {lcsc}.wrl", YLW)

    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="LCSC → KiCad Importer")
    parser.add_argument("parts", nargs="*", help="LCSC part numbers e.g. C417538")
    parser.add_argument("--bom", type=Path, help="KiCad BOM CSV")
    parser.add_argument("--library", type=Path, default=Path.cwd() / "lib")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.parts and not args.bom:
        parser.error("Provide LCSC parts or --bom file")

    lib_path = args.library
    ensure_libraries(lib_path)

    lcsc_list: List[str] = list(args.parts)
    if args.bom and args.bom.exists():
        lcsc_list.extend(parse_kicad_bom(args.bom))

    if not lcsc_list:
        print_progress("No parts to process", RED, "ERROR")
        sys.exit(1)

    success = 0
    for i, lcsc in enumerate(lcsc_list, 1):
        print_progress(f"[{i}/{len(lcsc_list)}] Processing {lcsc}", BLU)
        data = fetch_lcsc_component(lcsc)
        if not data:
            continue

        if not args.dry_run:
            create_backup(lib_path, lcsc)

        if args.dry_run:
            print_progress(f"DRY-RUN: Would import {lcsc}", BLU)
            success += 1
            continue

        if import_full_part(lib_path, lcsc, data):
            success += 1

    print_progress(f"Finished: {success}/{len(lcsc_list)} parts imported", GRN)
    if success > 0:
        print_progress(
            "Reload libraries in KiCad (Manage Symbol + Footprint Libraries)", GRN
        )
        print_progress(
            "Complex parts may still need manual pin/graphics refinement", YLW
        )


if __name__ == "__main__":
    main()
