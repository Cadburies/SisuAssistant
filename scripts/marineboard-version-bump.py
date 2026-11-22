#!/usr/bin/env python3
"""Bump the Sisu Marine Board revision and archive the previous design.

    ./scripts/marineboard-version-bump.py 1.11
    ./scripts/marineboard-version-bump.py 1.11 --dry-run
    ./scripts/marineboard-version-bump.py 1.11 --archive v1.10 --force

Run this only after a board spin. Never bump the board revision for a docs,
issue or firmware change; v1.9 is the five-board production design and
v1.10 is the current unbuilt design.

One bump does what a board spin does by hand:

  1. Reads the current version from MarineBoard/Technical Specs.md.
  2. Snapshots the current board into MarineBoard/<archive>/ (default v<old>):
     the four KiCad files, production/ (gerbers, BOM, positions), PCBWay/,
     Schematics/ (PNG renders), enclosure/ (sources and exports), and the
     order BOMs kept in Documentation/.
  3. Sets the new version on the KiCad silk (LOGO1 value), the schematic title
     text, and every current-version statement in the docs listed below.
  4. Appends a revision row to MarineBoard/Technical Specs.md and
     Technical Specifications.md. Existing history rows are never rewritten.

History rows (`| 1.91 | ... |`, `| **2.26** | ... |`) are left untouched;
so are the errata table's "Fixed in" cells and the GPIO table's "(1.91)" notes.

The script never commits and never moves Documentation/PCBWay delivery <date>/:
those belong to the revision they were delivered with, move them by hand.
If production/ is older than the KiCad files, rebuild it first
(`python3 MarineBoard/fab_package.py`, KiCad closed) — the script only warns.

Afterwards: ./scripts/verify.sh <changed files>, then commit with the repo flow.
"""
import argparse
import datetime
import fnmatch
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MB = ROOT / "MarineBoard"
SPEC = MB / "Technical Specs.md"
SYS_SPEC = ROOT / "Technical Specifications.md"

KICAD = ["MarineBoard.kicad_pcb", "MarineBoard.kicad_sch", "MarineBoard.kicad_pro", "MarineBoard.kicad_prl"]

# Every doc that states the *current* board revision. History rows in the two
# spec files are skipped by HISTORY_ROW; these files are rewritten wholesale.
CURRENT_DOCS = [
    "MarineBoard/README.md",
    "README.md",
    "Technical Specifications.md",
    "AGENTS.md",
    "INSTALLATION.md",
    "NETWORK.md",
    "OPS.md",
    ".ai_context/INDEX.md",
    ".ai_context/safety.md",
    ".ai_context/feature_map/esp/freezer/index.md",
    ".ai_context/feature_map/hw/marine-board/index.md",
    # Firmware target tags are deliberately not bumped with the board design:
    # the v1.9 firmware must keep its v1.9 target after the design moves on.
    "MarineBoard/daughter-fridge/technical spec.md",
    "MarineBoard/Documentation/Freezer-Replacement-Plan.md",
]

# Revision-history rows: a table row whose first cell is a version number.
HISTORY_ROW = re.compile(r"^\|\s*\*{0,2}\d+\.\d+\*{0,2}\s*\|")
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
ARCHIVE_SKIP = {".DS_Store", "__pycache__", "Backup", ".history"}


def die(msg: str) -> "NoReturn":
    print(f"marineboard-version-bump: {msg}", file=sys.stderr)
    raise SystemExit(1)


def read_current() -> str:
    m = re.search(r"^\*\*Version:\*\*\s*(\d+(?:\.\d+)+)", SPEC.read_text(encoding="utf-8"), re.M)
    if not m:
        die(f"no '**Version:** <ver>' line in {SPEC.relative_to(ROOT)}")
    return m.group(1)


def token(version: str) -> str:
    """Regex for a v-prefixed revision that does not run into more digits."""
    return r"(?<![\w.])v" + re.escape(version) + r"(?![A-Za-z0-9_]|\.\d)"


def ignored(_dir: str, names: list[str]) -> list[str]:
    return [n for n in names if n in ARCHIVE_SKIP or fnmatch.fnmatch(n, "*.FCBak")]


def plan_archive(archive: Path) -> list[tuple[Path, Path]]:
    """Source -> destination pairs, in copy order."""
    pairs: list[tuple[Path, Path]] = []
    for name in KICAD:
        pairs.append((MB / name, archive / name))
    for folder, dest in [("production", "production"), ("PCBWay", "PCBWay")]:
        src = MB / folder
        if src.is_dir():
            pairs.append((src, archive / dest))
    pngs = MB / "Documentation" / "Schematics"
    if pngs.is_dir():
        pairs.append((pngs, archive / "Schematics"))
    if (MB / "enclosure").is_dir():
        pairs.append((MB / "enclosure", archive / "enclosure"))
    for pattern, dest in [
        ("MarineBoard-BOM-5units-*.xls", "production"),
        ("MarineBoard-enclosure-PCBWay-BOM.xlsx", "production"),
    ]:
        for f in sorted((MB / "Documentation").glob(pattern)):
            pairs.append((f, archive / dest / f.name))
    return pairs


def copy_pair(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        if dst.exists():
            shutil.rmtree(dst)
        if src.name == "Schematics":
            dst.mkdir(parents=True, exist_ok=True)
            for f in sorted(src.glob("*.png")):
                shutil.copy2(f, dst / f.name)
        else:
            shutil.copytree(src, dst, ignore=ignored)
    else:
        shutil.copy2(src, dst)


def bump_text(path: Path, old: str, new: str, *, skip_history: bool, dry: bool = False) -> int:
    """Replace v<old> with v<new> on every line outside the history tables."""
    if not path.is_file():
        return 0
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    pattern = re.compile(token(old))
    changed = 0
    out = []
    for line in lines:
        if skip_history and HISTORY_ROW.match(line):
            out.append(line)
            continue
        replaced, n = pattern.subn(f"v{new}", line)
        changed += n
        out.append(replaced)
    if changed and not dry:
        path.write_text("".join(out), encoding="utf-8")
    return changed


def sub_file(path: Path, pattern: str, repl: str, *, dry: bool = False) -> int:
    if not path.is_file():
        return 0
    text = path.read_text(encoding="utf-8")
    new_text, n = re.subn(pattern, repl, text)
    if n and not dry:
        path.write_text(new_text, encoding="utf-8")
    return n


def set_doc_date(path: Path, month_year: str, *, dry: bool = False) -> None:
    sub_file(path, r"^\*\*Date:\*\* .*$", f"**Date:** {month_year}", dry=dry)


def set_title_block(path: Path, rev: str, month_year: str, *, dry: bool = False) -> int:
    """Insert or update the schematic title block; return the fields changed."""
    if not path.is_file():
        return 0
    with path.open("r", encoding="utf-8", newline="") as f:
        text = f.read()
    newline = "\r\n" if "\r\n" in text else "\n"
    text = text.replace("\r\n", "\n")
    fields = {
        "title": "Sisu Marine Board",
        "date": month_year,
        "rev": rev,
        "company": "Sisu",
    }
    changed = 0
    m = re.search(r"(?ms)^([ \t]*)\(title_block\n.*?^\1\)\n", text)
    if m:
        block = m.group(0)
        new_block = block
        for name, value in fields.items():
            new_block, n = re.subn(
                rf'(?m)^([ \t]+\({name} ")[^"]*("\))$',
                lambda mm, v=value: mm.group(1) + v + mm.group(2),
                new_block,
            )
            changed += n
        if new_block != block:
            text = text[: m.start()] + new_block + text[m.end() :]
    elif "(title_block" in text:
        die(f"cannot parse title_block in {path}")
    else:
        paper = re.search(r'(?m)^([ \t]*)\(paper "[^"]*"[^\n]*\)\n', text)
        if not paper:
            return 0
        indent = paper.group(1)
        body = "".join(f'{indent}\t({name} "{value}")\n' for name, value in fields.items())
        text = text[: paper.end()] + f"{indent}(title_block\n" + body + f"{indent})\n" + text[paper.end() :]
        changed = len(fields)
    if changed and not dry:
        with path.open("w", encoding="utf-8", newline="") as f:
            f.write(text.replace("\n", newline))
    return changed


def append_history(path: Path, row: str, *, dry: bool = False) -> bool:
    """Insert row after the last version-labelled table row."""
    if not path.is_file():
        return False
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    last = None
    for i, line in enumerate(lines):
        if HISTORY_ROW.match(line):
            last = i
    if last is None:
        return False
    if not dry:
        lines.insert(last + 1, row + "\n")
        path.write_text("".join(lines), encoding="utf-8")
    return True


def next_sys_revision() -> str:
    text = SYS_SPEC.read_text(encoding="utf-8")
    found = re.findall(r"^\|\s*\*\*(\d+)\.(\d+)\*\*\s*\|", text, re.M)
    if not found:
        return "2.1"
    major, minor = found[-1]
    return f"{major}.{int(minor) + 1}"


def newest(paths: list[Path]) -> float:
    return max((p.stat().st_mtime for p in paths if p.exists()), default=0.0)


def main() -> int:
    ap = argparse.ArgumentParser(description="Archive the current Marine Board design and bump its version.")
    ap.add_argument("version", help="new board revision, e.g. 1.92")
    ap.add_argument("--archive", help="archive folder under MarineBoard/ (default: v<current version>)")
    ap.add_argument("--date", help="revision date, e.g. 'Nov 2026' (default: today)")
    ap.add_argument("--force", action="store_true", help="replace an existing archive folder")
    ap.add_argument("--dry-run", action="store_true", help="print the plan, write nothing")
    args = ap.parse_args()

    if not re.fullmatch(r"\d+(?:\.\d+)+", args.version):
        die(f"'{args.version}' is not a version like 1.92")
    old = read_current()
    if args.version == old:
        die(f"already at {old}")
    archive_name = args.archive or f"v{old}"
    if not re.fullmatch(r"v?[A-Za-z0-9._-]+", archive_name):
        die(f"bad archive name '{archive_name}'")
    archive = MB / archive_name
    try:
        archive_rel = archive.relative_to(ROOT)
    except ValueError:
        die("archive folder must live under MarineBoard/")
    month_year = args.date or f"{MONTHS[datetime.date.today().month - 1]} {datetime.date.today().year}"

    if archive.exists() and not args.force:
        die(f"{archive_rel} already exists (use --force to replace it)")

    # Warn if the fab package predates the current KiCad files.
    kicad = [MB / n for n in KICAD]
    prod = MB / "production"
    prod_files = list(prod.rglob("*")) if prod.is_dir() else []
    if prod_files and newest(prod_files) < newest(kicad):
        print("warning: production/ is older than the KiCad files; rebuild it first with fab_package.py")

    pairs = plan_archive(archive)
    print(f"bump {old} -> {args.version}; archive {archive_rel}/ ({len(pairs)} sources)")
    for src, dst in pairs:
        print(f"  {'would copy' if args.dry_run else 'copy'} {src.relative_to(ROOT)} -> {dst.relative_to(ROOT)}")
        if not args.dry_run:
            if dst.exists() and not dst.is_dir():
                dst.unlink()
            copy_pair(src, dst)

    changed: dict[str, int] = {}

    # Version tokens in the current-state docs.
    for rel in CURRENT_DOCS:
        path = ROOT / rel
        n = bump_text(path, old, new=args.version, skip_history=rel in {"Technical Specifications.md"},
                      dry=args.dry_run)
        if n:
            changed[rel] = changed.get(rel, 0) + n
    # The spec's history table is protected, but its header and body prose are
    # current-state: rewrite around it.
    spec_rel = str(SPEC.relative_to(ROOT))
    n = bump_text(SPEC, old, args.version, skip_history=True, dry=args.dry_run)
    if n:
        changed[spec_rel] = changed.get(spec_rel, 0) + n
    n = sub_file(SPEC, r"(?m)^(\*\*Version:\*\* )\d+(?:\.\d+)+", rf"\g<1>{args.version}", dry=args.dry_run)
    if n:
        changed[spec_rel] = changed.get(spec_rel, 0) + n
    set_doc_date(SPEC, month_year, dry=args.dry_run)

    # KiCad silk and schematic title.
    for name in ("MarineBoard.kicad_pcb", "MarineBoard.kicad_sch"):
        n = bump_text(MB / name, old, args.version, skip_history=False, dry=args.dry_run)
        if n:
            changed[f"MarineBoard/{name}"] = changed.get(f"MarineBoard/{name}", 0) + n
    n = set_title_block(MB / "MarineBoard.kicad_sch", args.version, month_year, dry=args.dry_run)
    if n:
        changed["MarineBoard/MarineBoard.kicad_sch"] = (
            changed.get("MarineBoard/MarineBoard.kicad_sch", 0) + n
        )

    # Point the "previous design is archived" sentences at the new snapshot.
    archive_docs = {
        "MarineBoard/README.md": (
            r"The previous \*\*v[^*]+\*\* design is archived in \[[^\]]+\]\([^)]+\)",
            f"The previous **v{old}** design is archived in [`{archive_name}/`]({archive_name}/)",
        ),
        "README.md": (
            r"The earlier \*\*v[^*]+\*\* design is archived in \[[^\]]+\]\([^)]+\)[^.]*\.",
            f"The earlier **v{old}** design is archived in [`MarineBoard/{archive_name}/`](MarineBoard/{archive_name}/)"
            " with its `production/` fab package, `PCBWay/` order files, schematic renders, and enclosure sources.",
        ),
        ".ai_context/INDEX.md": (
            r"v[0-9][^\s]* design archived \(`MarineBoard/[^`]+/`\)",
            f"v{old} design archived (`MarineBoard/{archive_name}/`)",
        ),
    }
    for rel, (pattern, repl) in archive_docs.items():
        n = sub_file(ROOT / rel, pattern, repl, dry=args.dry_run)
        if n:
            changed[rel] = changed.get(rel, 0) + n
    spec_status = (
        r"the v[0-9][^\s]* design is archived in \[`[^`]+`\]\([^)]+\)(?: \([^)]*\))?",
        f"the v{old} design is archived in [`{archive_name}/`]({archive_name}/)"
        " (project, fab package, PCBWay order, schematic renders, enclosure)",
    )
    n = sub_file(SPEC, *spec_status, dry=args.dry_run)
    if n:
        changed[spec_rel] = changed.get(spec_rel, 0) + n

    # Revision rows.
    row = (
        f"| {args.version} | {month_year} | **Version increased to {args.version}.** "
        f"KiCad project, `production/`, `PCBWay/`, `Schematics/`, and `enclosure/` archived in "
        f"[`{archive_name}/`]({archive_name}/). Board silk, schematic title, and title block set to **v{args.version}**. "
        "No copper change. |"
    )
    append_history(SPEC, row, dry=args.dry_run)
    sys_row = (
        f"| **{next_sys_revision()}** | **{month_year}** | Marine Board version increased to "
        f"**v{args.version}**; the v{old} design is archived in `MarineBoard/{archive_name}/`. |"
    )
    append_history(SYS_SPEC, sys_row, dry=args.dry_run)

    verb = "would change" if args.dry_run else "changed"
    print(f"\n{verb} {sum(changed.values())} version mention(s) in {len(changed)} file(s):")
    for rel in sorted(changed):
        print(f"  {rel} ({changed[rel]})")
    if not changed:
        print("  (none — check that the docs still name the current revision)")
    print("\nnext: ./scripts/verify.sh <changed files>; then commit with the repo flow")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
