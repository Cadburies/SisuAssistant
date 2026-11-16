#!/usr/bin/env python3
"""Move footprints that are already on a KiCad 10 board.

A placement table gives reference, x, y, rotation, and side. This script
writes those positions. kicad-cli reads them back. It does not draw tracks.
A side change calls KiCad's Flip only after LoadBoard has put the footprint
on the board. Flipping a footprint before that leaves the board pointer null.
"""

from __future__ import annotations

import contextlib
import csv
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import uuid
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kicad_sym import (  # noqa: E402
    OFFICIAL_FPS,
    ROOT,
    Node,
    atom_at,
    cli_report,
    die,
    head,
    KICAD_CLI,
    kicad,
    parse,
    q,
    refuse_write,
    unquote,
)

EXAMPLE = (
    Path(__file__).resolve().parents[1]
    / "place-footprints"
    / "examples"
    / "two-parts.json"
)
POS_SIDE = {"top": "front", "bottom": "back", "front": "front", "back": "back"}
MM = Decimal("0.001")
DEG = Decimal("0.05")

BOARD_PREFIX = """(kicad_pcb
	(version 20260206)
	(generator "kicad_pcb")
	(generator_version "10.0")
	(general
		(thickness 1.6)
		(legacy_teardrops no)
	)
	(paper "A4")
	(layers
		(0 "F.Cu" signal)
		(2 "B.Cu" signal)
		(9 "F.Adhes" user "F.Adhesive")
		(11 "B.Adhes" user "B.Adhesive")
		(13 "F.Paste" user)
		(15 "B.Paste" user)
		(5 "F.SilkS" user "F.Silkscreen")
		(7 "B.SilkS" user "B.Silkscreen")
		(1 "F.Mask" user)
		(3 "B.Mask" user)
		(17 "Dwgs.User" user "User.Drawings")
		(19 "Cmts.User" user "User.Comments")
		(21 "Eco1.User" user "User.Eco1")
		(23 "Eco2.User" user "User.Eco2")
		(25 "Edge.Cuts" user)
		(27 "Margin" user)
		(31 "F.CrtYd" user "F.Courtyard")
		(29 "B.CrtYd" user "B.Courtyard")
		(35 "F.Fab" user)
		(33 "B.Fab" user)
	)
	(setup
		(pad_to_mask_clearance 0)
		(allow_soldermask_bridges_in_footprints no)
	)
)
"""


def fmt_num(value: Decimal) -> str:
    number = Decimal(value).quantize(Decimal("0.000001"))
    if number == 0:
        return "0"
    text = format(number, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def norm_angle(value: Decimal) -> Decimal:
    number = (Decimal(value) % Decimal(360)).quantize(Decimal("0.000001"))
    if number > 180:
        number -= Decimal(360)
    elif number <= -180:
        number += Decimal(360)
    if number == 0:
        return Decimal(0)
    return number


def near(a: Decimal, b: Decimal, tol: Decimal = MM) -> bool:
    return abs(Decimal(a) - Decimal(b)) <= tol


def ang_near(a: Decimal, b: Decimal) -> bool:
    return abs(norm_angle(Decimal(a) - Decimal(b))) <= DEG


def load_table(path: Path) -> list[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        die(f"cannot read placement table {path}: {exc}")
    if not isinstance(data, dict) or data.get("units") != "mm":
        die('placement table units must be "mm"')
    parts = data.get("parts")
    if not isinstance(parts, list):
        die("placement table needs a parts list")
    rows = []
    seen = set()
    for part in parts:
        if not isinstance(part, dict):
            die("each part must be an object")
        ref = part.get("ref")
        if not isinstance(ref, str) or not ref:
            die("each part needs a ref")
        if ref in seen:
            die(f"duplicate {ref} in the placement table")
        seen.add(ref)
        if "rot" not in part:
            die(f"{ref} needs rot")
        side = part.get("side")
        if side not in {"front", "back"}:
            die(f"{ref} side must be front or back")
        try:
            x = Decimal(str(part["x"]))
            y = Decimal(str(part["y"]))
            rot = Decimal(str(part["rot"]))
        except Exception:
            die(f"{ref} x, y, and rot must be numbers")
        rows.append({"ref": ref, "x": x, "y": y, "rot": rot, "side": side})
    return rows


def number_atoms(node: Node) -> list[Decimal]:
    numbers = []
    for child in node.children[1:]:
        if child.kind == "list":
            break
        try:
            numbers.append(Decimal(unquote(child.value)))
        except Exception:
            die(f"expected a number in ({head(node)})")
    return numbers


def reference_of(fp: Node) -> str:
    for child in fp.children:
        if head(child) == "property" and atom_at(child, 1) == "Reference":
            ref = atom_at(child, 2) or ""
            if ref:
                return ref
    die("a footprint has no Reference")
    return ""


def board_at(fp: Node) -> Node:
    for child in fp.children:
        if head(child) == "at":
            return child
    die(f"{reference_of(fp)} has no position")
    raise AssertionError


def side_of(fp: Node) -> str:
    for child in fp.children:
        if head(child) == "layer":
            layer = atom_at(child, 1)
            if layer == "F.Cu":
                return "front"
            if layer == "B.Cu":
                return "back"
            die(f"{reference_of(fp)} is on layer {layer}")
    die(f"{reference_of(fp)} has no layer")
    return ""


def locked(fp: Node) -> bool:
    return any(head(child) == "locked" for child in fp.children)


def iter_footprints(tree: Node) -> list[tuple[str, Node]]:
    if head(tree) != "kicad_pcb":
        die("not a kicad_pcb")
    rows = []
    seen = set()
    for node in tree.children:
        if head(node) != "footprint":
            continue
        ref = reference_of(node)
        if ref in seen:
            die(f"duplicate {ref} on the board")
        seen.add(ref)
        rows.append((ref, node))
    return rows


def add_edit(edits: list, text: str, start: int, end: int, new: str) -> None:
    if text[start:end] != new:
        edits.append((start, end, new))


def splice(text: str, edits: list[tuple[int, int, str]]) -> str:
    ordered = sorted(edits, key=lambda item: (item[0], item[1]), reverse=True)
    for index in range(len(ordered) - 1):
        if ordered[index][0] < ordered[index + 1][1]:
            die(
                "overlapping board edits at "
                f"{ordered[index + 1][0]}..{ordered[index][1]}"
            )
    for start, end, new in ordered:
        text = text[:start] + new + text[end:]
    return text


def copper_counts(text: str) -> tuple[int, int, int]:
    return (text.count("(segment"), text.count("(via"), text.count("(zone"))


def cmd_list(board: Path) -> None:
    if not board.is_file():
        die(f"no board {board}")
    for ref, fp in iter_footprints(parse(board.read_text(encoding="utf-8"))):
        numbers = number_atoms(board_at(fp))
        rot = numbers[2] if len(numbers) >= 3 else Decimal(0)
        print(
            f"{ref} {fmt_num(numbers[0])} {fmt_num(numbers[1])} "
            f"{fmt_num(norm_angle(rot))} {side_of(fp)}"
        )


def read_pos(path: Path) -> dict[str, dict]:
    found = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            side = POS_SIDE.get((row.get("Side") or "").strip().lower())
            if side is None:
                die(f"unexpected position-file side {row.get('Side')!r}")
            ref = (row.get("Ref") or "").strip()
            try:
                found[ref] = {
                    "x": Decimal(row["PosX"]),
                    "y": Decimal(row["PosY"]),
                    "rot": Decimal(row["Rot"]),
                    "side": side,
                }
            except Exception:
                die(f"bad position-file row for {ref}")
    return found


def cmd_check(board: Path, table: Path) -> None:
    if not board.is_file():
        die(f"no board {board}")
    rows = load_table(table)
    text = board.read_text(encoding="utf-8")
    by_ref = dict(iter_footprints(parse(text)))
    mismatches = []
    for row in rows:
        fp = by_ref.get(row["ref"])
        if fp is None:
            mismatches.append(f"{row['ref']} is not on the board")
            continue
        numbers = number_atoms(board_at(fp))
        rot = numbers[2] if len(numbers) >= 3 else Decimal(0)
        side = side_of(fp)
        if (
            not near(numbers[0], row["x"])
            or not near(numbers[1], row["y"])
            or not ang_near(rot, row["rot"])
            or side != row["side"]
        ):
            mismatches.append(
                f"{row['ref']} board file {fmt_num(numbers[0])} {fmt_num(numbers[1])} "
                f"{fmt_num(norm_angle(rot))} {side}"
            )
    with tempfile.TemporaryDirectory(prefix="kicad-pos-") as tmp:
        csv_path = Path(tmp) / "pos.csv"
        proc = kicad(
            "pcb", "export", "pos",
            "--format", "csv",
            "--units", "mm",
            "--output", str(csv_path),
            str(board),
        )
        if proc.returncode != 0 or not csv_path.is_file():
            die(f"kicad-cli pcb export pos failed:\n{proc.stderr or proc.stdout}")
        exported = read_pos(csv_path)
    for row in rows:
        got = exported.get(row["ref"])
        if got is None:
            mismatches.append(f"{row['ref']} is missing from the position file")
            continue
        # The position file negates Y. The table uses the board-file Y.
        file_y = -got["y"]
        if (
            not near(got["x"], row["x"])
            or not near(file_y, row["y"])
            or not ang_near(got["rot"], row["rot"])
            or got["side"] != row["side"]
        ):
            mismatches.append(
                f"{row['ref']} position file {got['x']} {got['y']} {got['rot']} {got['side']}"
            )
    if mismatches:
        for line in mismatches:
            print(line)
        raise SystemExit(1)
    print(f"{len(rows)} parts match the position file")


def same_place(fp: Node, row: dict) -> bool:
    numbers = number_atoms(board_at(fp))
    if len(numbers) < 2:
        return False
    rot = numbers[2] if len(numbers) >= 3 else Decimal(0)
    return (
        near(numbers[0], row["x"])
        and near(numbers[1], row["y"])
        and ang_near(rot, row["rot"])
        and side_of(fp) == row["side"]
    )


def kicad_python() -> Path:
    override = os.environ.get("KICAD_PYTHON")
    if override:
        return Path(override)
    return (
        KICAD_CLI.parents[2]
        / "Contents/Frameworks/Python.framework/Versions/3.9/bin/python3"
    )


# KiCad's Python runs this. LoadBoard first. Flip only sees footprints that
# call GetBoard() successfully, because Flip uses that pointer.
FLIP_HELPER = """
import json, sys, pcbnew
board_path, table_path = sys.argv[1], sys.argv[2]
rows = json.loads(open(table_path, encoding="utf-8").read())
board = pcbnew.LoadBoard(board_path)
for row in rows:
    fp = board.FindFootprintByReference(row["ref"])
    if fp is None or fp.GetBoard() is None:
        sys.stderr.write("%s is not on the board\\n" % row["ref"])
        raise SystemExit(1)
    if bool(fp.IsFlipped()) != (row["side"] == "back"):
        fp.Flip(fp.GetPosition(), pcbnew.FLIP_DIRECTION_TOP_BOTTOM)
    fp.SetPosition(pcbnew.VECTOR2I_MM(float(row["x"]), float(row["y"])))
    fp.SetOrientation(pcbnew.EDA_ANGLE(float(row["rot"]), pcbnew.DEGREES_T))
    for field in fp.GetFields():
        field.KeepUpright()
    for item in fp.GraphicalItems():
        if isinstance(item, pcbnew.PCB_TEXT):
            item.KeepUpright()
pcbnew.SaveBoard(board_path, board)
"""


def move_on_board(text: str, rows: list[dict]) -> str:
    py = kicad_python()
    if not py.is_file():
        die(f"KiCad Python not found at {py}. Set KICAD_PYTHON.")
    payload = [
        {
            "ref": row["ref"],
            "x": format(row["x"], "f"),
            "y": format(row["y"], "f"),
            "rot": format(row["rot"], "f"),
            "side": row["side"],
        }
        for row in rows
    ]
    with tempfile.TemporaryDirectory(prefix="kicad-flip-") as tmp:
        work = Path(tmp)
        board_path = work / "board.kicad_pcb"
        table_path = work / "table.json"
        board_path.write_text(text, encoding="utf-8")
        table_path.write_text(json.dumps(payload), encoding="utf-8")
        proc = subprocess.run(
            [str(py), "-", str(board_path), str(table_path)],
            input=FLIP_HELPER,
            text=True,
            capture_output=True,
        )
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "").strip()
            die(f"KiCad Flip failed:\n{detail}")
        saved = board_path.read_text(encoding="utf-8")
    old_map = dict(iter_footprints(parse(text)))
    new_map = dict(iter_footprints(parse(saved)))
    edits: list[tuple[int, int, str]] = []
    for row in rows:
        ref = row["ref"]
        new = new_map.get(ref)
        if new is None:
            die(f"{ref} missing after Flip")
        old = old_map[ref]
        add_edit(edits, text, old.start, old.end, saved[new.start : new.end])
    return splice(text, edits)


def cmd_apply(board: Path, table: Path) -> None:
    refuse_write(board)
    rows = load_table(table)
    if not board.is_file():
        die(f"no board {board}")
    text = board.read_text(encoding="utf-8")
    before_copper = copper_counts(text)
    by_ref = dict(iter_footprints(parse(text)))
    for row in rows:
        fp = by_ref.get(row["ref"])
        if fp is None:
            die(f"{row['ref']} is not on the board")
        if locked(fp):
            die(f"{row['ref']} is locked")
    moving = [row for row in rows if not same_place(by_ref[row["ref"]], row)]
    if not moving:
        print("no change")
        return
    for row in moving:
        fp = by_ref[row["ref"]]
        old = number_atoms(board_at(fp))
        old_rot = old[2] if len(old) >= 3 else Decimal(0)
        print(
            f"{row['ref']} {fmt_num(old[0])} {fmt_num(old[1])} "
            f"{fmt_num(norm_angle(old_rot))} {side_of(fp)} -> "
            f"{fmt_num(row['x'])} {fmt_num(row['y'])} "
            f"{fmt_num(norm_angle(row['rot']))} {row['side']}"
        )
    new = move_on_board(text, moving)
    if copper_counts(new) != before_copper:
        die("refusing to write because a track, via, or zone would change")
    board.write_text(new, encoding="utf-8")
    print(f"wrote {board}")


def cmd_picture(board: Path, out: Path) -> None:
    if not board.is_file():
        die(f"no board {board}")
    out.mkdir(parents=True, exist_ok=True)
    for layer in ("F.Cu", "B.Cu"):
        dest = out / f"{layer}.svg"
        proc = kicad(
            "pcb", "export", "svg",
            "--mode-single",
            "--output", str(dest),
            "--layers", layer,
            "--exclude-drawing-sheet",
            "--page-size-mode", "2",
            str(board),
        )
        if proc.returncode != 0 or not dest.is_file():
            die(f"kicad-cli pcb export svg failed for {layer}:\n{proc.stderr or proc.stdout}")
        print(dest)


def strip_library_header(text: str) -> str:
    tree = parse(text)
    drop = [
        node for node in tree.children
        if head(node) in {"version", "generator", "generator_version"}
    ]
    for node in sorted(drop, key=lambda item: item.start, reverse=True):
        text = text[: node.start] + text[node.end :]
    return text


def embed_footprint(mod_text: str, lib_id: str, ref: str, x: Decimal, y: Decimal, rot: Decimal) -> str:
    text = strip_library_header(mod_text)
    tree = parse(text)
    if len(tree.children) < 2 or tree.children[1].kind == "list":
        die(f"{lib_id} has no footprint name")
    name = tree.children[1]
    text = text[: name.start] + q(lib_id) + text[name.end :]
    tree = parse(text)
    renamed = False
    for node in tree.children:
        if head(node) == "property" and atom_at(node, 1) == "Reference" and len(node.children) > 2:
            token = node.children[2]
            text = text[: token.start] + q(ref) + text[token.end :]
            renamed = True
            break
    if not renamed:
        die(f"{lib_id} has no Reference")
    tree = parse(text)
    layer = next((node for node in tree.children if head(node) == "layer"), None)
    if layer is None:
        die(f"{lib_id} has no layer")
    angle = ""
    shown = norm_angle(rot)
    if shown != 0:
        angle = " " + fmt_num(shown)
    extra = f'\n\t(uuid "{uuid.uuid4()}")\n\t(at {fmt_num(x)} {fmt_num(y)}{angle})'
    return text[: layer.end] + extra + text[layer.end :]


def loadable_board(body: str) -> str:
    """Give a bare sexp the header KiCad's Python needs before LoadBoard."""
    if "(version " in body:
        return body
    inner = body.strip()
    if inner.startswith("(kicad_pcb"):
        inner = inner[len("(kicad_pcb") :].strip()
        if inner.endswith(")"):
            inner = inner[:-1]
    prefix = BOARD_PREFIX.rstrip()
    return prefix[:-1] + "\n" + inner + "\n)\n"


def fresh_board(footprint: str) -> str:
    close = BOARD_PREFIX.rstrip()
    if not close.endswith(")"):
        die("board prefix is not closed")
    edge = (
        "\t(gr_rect\n"
        "\t\t(start 10 10)\n"
        "\t\t(end 80 70)\n"
        "\t\t(stroke\n"
        "\t\t\t(width 0.1)\n"
        "\t\t\t(type solid)\n"
        "\t\t)\n"
        "\t\t(fill no)\n"
        '\t\t(layer "Edge.Cuts")\n'
        f'\t\t(uuid "{uuid.uuid4()}")\n'
        "\t)\n"
    )
    return close[:-1] + "\n" + footprint + "\n" + edge + "\t(embedded_fonts no)\n)\n"


def copper_bboxes(svg: str) -> list[tuple[float, float, float, float]]:
    boxes = []
    for match in re.finditer(r"<path\b[^>]*>", svg):
        tag = match.group(0)
        fill = re.search(r"fill:(#[0-9A-Fa-f]{6})", tag)
        if fill is None or fill.group(1).lower() in {"#000000", "#ffffff"}:
            continue
        drawn = re.search(r'\bd="([^"]+)"', tag)
        if drawn is None:
            continue
        nums = [float(item) for item in re.findall(r"[-+]?(?:\d+\.\d+|\d+|\.\d+)", drawn.group(1))]
        if len(nums) < 4:
            continue
        xs, ys = nums[0::2], nums[1::2]
        width, height = max(xs) - min(xs), max(ys) - min(ys)
        area = width * height
        if width < 0.05 or height < 0.05 or area < 0.3 or area > 3:
            continue
        boxes.append((min(xs), min(ys), max(xs), max(ys)))
    return boxes


def expect_exit(fn, code: int, label: str) -> None:
    try:
        fn()
    except SystemExit as exc:
        if exc.code != code:
            die(f"selftest: {label} exited {exc.code}, want {code}")
    else:
        die(f"selftest: {label} did not exit")


def write_table(path: Path, parts: list[dict]) -> None:
    path.write_text(json.dumps({"units": "mm", "parts": parts}), encoding="utf-8")


def pad_numbers(fp: Node, number: str) -> list[Decimal]:
    for child in fp.children:
        if head(child) == "pad" and atom_at(child, 1) == number:
            at = next((node for node in child.children if head(node) == "at"), None)
            if at is None:
                die(f"pad {number} has no at")
            return number_atoms(at)
    die(f"pad {number} missing")
    return []


def assert_geometry(svg: str, expected: list[tuple[float, float]], vertical: bool) -> None:
    boxes = copper_bboxes(svg)
    if len(boxes) != 3:
        die(f"selftest: expected 3 copper pads, found {len(boxes)}")
    for left, top, right, bottom in boxes:
        width, height = right - left, bottom - top
        if vertical and not height > width * 1.5:
            die(f"selftest: pad bbox {width:.3f} x {height:.3f} stayed flat")
        if not vertical and not width > height * 1.5:
            die(f"selftest: pad bbox {width:.3f} x {height:.3f} stayed tall")
    centers = [((left + right) / 2, (top + bottom) / 2) for left, top, right, bottom in boxes]
    gx = sum(point[0] for point in centers) / 3
    gy = sum(point[1] for point in centers) / 3
    ex = sum(point[0] for point in expected) / 3
    ey = sum(point[1] for point in expected) / 3
    got = [(point[0] - gx, point[1] - gy) for point in centers]
    for px, py in expected:
        if not any(abs(px - ex - item[0]) < 0.08 and abs(py - ey - item[1]) < 0.08 for item in got):
            die(f"selftest: pad centers {got} do not match {expected}")


TINY = """(kicad_pcb
	(footprint "Lib:A"
		(layer "F.Cu")
		(at 1 2 0)
		(property "Reference" "Q1"
			(at 0 -1 0)
			(effects
				(font
					(size 1 1)
				)
			)
		)
		(pad "1" smd rect
			(at -0.5 -0.25)
			(size 1 0.5)
			(layers "F.Cu" "F.Paste" "F.Mask")
		)
		(fp_line
			(start -1 -1)
			(end 1 -1)
			(layer "F.SilkS")
		)
	)
	(footprint "Lib:B"
		(layer "F.Cu")
		(at 9 8)
		(property "Reference" "R1"
			(at 0 0 0)
		)
		(pad "1" smd rect
			(at 0.4 0)
			(layers "F.Cu")
		)
		(locked yes)
	)
)
"""


def footprint_text(text: str, ref: str) -> str:
    tree = parse(text)
    for name, node in iter_footprints(tree):
        if name == ref:
            return text[node.start : node.end]
    die(f"selftest: {ref} missing after apply")
    return ""


def cmd_selftest() -> None:
    if norm_angle(Decimal("-90")) != Decimal("-90"):
        die("selftest: -90 did not stay -90")
    if norm_angle(Decimal("-180")) != Decimal("180"):
        die("selftest: -180 did not become 180")
    if norm_angle(Decimal("270")) != Decimal("-90"):
        die("selftest: 270 did not become -90")
    if fmt_num(Decimal("-0")) != "0":
        die("selftest: negative zero")
    body = Path(__file__).read_text(encoding="utf-8").split("def cmd_selftest", 1)[0]
    flip_at = body.find(".Flip(")
    guard_at = body.find("GetBoard()")
    if flip_at < 0 or guard_at < 0 or guard_at > flip_at:
        die("selftest: Flip before the footprint is on a board")
    for flag in (
        "--" + "save-board",
        "--" + "refill-zones",
        "--" + "bottom-negate-x",
        "--" + "use-drill-file-origin",
        "--" + "check-zones",
    ):
        if flag in body:
            die(f"selftest: writer contains {flag}")
    sample = load_table(EXAMPLE)
    if [row["ref"] for row in sample] != ["Q1", "R1"]:
        die(f"selftest: example refs {[row['ref'] for row in sample]}")

    with tempfile.TemporaryDirectory(prefix="kicad-place-") as tmp:
        work = Path(tmp)
        tiny = work / "tiny.kicad_pcb"
        tiny.write_text(loadable_board(TINY), encoding="utf-8")
        one = work / "q1.json"
        write_table(one, [{"ref": "Q1", "x": 3, "y": 4, "rot": 90, "side": "front"}])
        cmd_apply(tiny, one)
        moved = tiny.read_text(encoding="utf-8")
        q1 = dict(iter_footprints(parse(moved)))["Q1"]
        at = number_atoms(board_at(q1))
        if at[:2] != [Decimal(3), Decimal(4)] or norm_angle(at[2]) != Decimal(90):
            die(f"selftest: Q1 moved to {at}")
        if side_of(q1) != "front":
            die("selftest: rotation changed the side")
        if "(at 0 -1 90)" not in footprint_text(moved, "Q1"):
            die("selftest: reference did not rotate")
        if pad_numbers(q1, "1") != [Decimal("-0.5"), Decimal("-0.25"), Decimal(90)]:
            die(f"selftest: pad angle {pad_numbers(q1, '1')}")
        r1 = dict(iter_footprints(parse(moved)))["R1"]
        if number_atoms(board_at(r1))[:2] != [Decimal(9), Decimal(8)] or not locked(r1):
            die("selftest: unlisted locked footprint moved")
        back = work / "back.json"
        write_table(back, [{"ref": "Q1", "x": 3, "y": 4, "rot": 0, "side": "back"}])
        cmd_apply(tiny, back)
        flipped = tiny.read_text(encoding="utf-8")
        q1 = dict(iter_footprints(parse(flipped)))["Q1"]
        if pad_numbers(q1, "1") != [Decimal("-0.5"), Decimal("0.25")]:
            die(f"selftest: flipped pad {pad_numbers(q1, '1')}")
        if side_of(q1) != "back" or "(layer \"B.SilkS\")" not in footprint_text(flipped, "Q1"):
            die("selftest: flip did not swap layers")
        body_q = footprint_text(flipped, "Q1")
        if "(at 0 1 0)" not in body_q or "(justify mirror)" not in body_q:
            die("selftest: reference text was not mirrored")
        if "(start -1 1)" not in body_q or "(end 1 1)" not in body_q:
            die("selftest: graphic Y was not mirrored")
        again = flipped
        cmd_apply(tiny, back)
        if tiny.read_text(encoding="utf-8") != again:
            die("selftest: second apply was not idempotent")
        if copper_counts(tiny.read_text(encoding="utf-8")) != (0, 0, 0):
            die("selftest: tiny board grew copper")

        dup = work / "dup.kicad_pcb"
        dup.write_text(TINY.replace('"R1"', '"Q1"', 1), encoding="utf-8")
        before = dup.read_bytes()
        expect_exit(lambda: cmd_apply(dup, one), 1, "duplicate reference")
        if dup.read_bytes() != before:
            die("selftest: duplicate board was written")
        missing = work / "missing.json"
        write_table(missing, [{"ref": "Q9", "x": 1, "y": 2, "rot": 0, "side": "front"}])
        plain = work / "plain.kicad_pcb"
        plain.write_text(TINY, encoding="utf-8")
        before = plain.read_bytes()
        expect_exit(lambda: cmd_apply(plain, missing), 1, "unknown reference")
        if plain.read_bytes() != before:
            die("selftest: unknown reference was written")
        locked_table = work / "locked.json"
        write_table(locked_table, [{"ref": "R1", "x": 1, "y": 2, "rot": 0, "side": "front"}])
        expect_exit(lambda: cmd_apply(plain, locked_table), 1, "locked footprint")
        if plain.read_bytes() != before:
            die("selftest: locked footprint was written")

        prod = ROOT / "MarineBoard" / "MarineBoard.kicad_pcb"
        sch = ROOT / "MarineBoard" / "MarineBoard.kicad_sch"
        prod_stamp = prod.stat().st_mtime_ns
        sch_stamp = sch.stat().st_mtime_ns
        expect_exit(lambda: cmd_apply(prod, EXAMPLE), 2, "production board")
        expect_exit(lambda: cmd_apply(sch, EXAMPLE), 2, "production schematic")
        if prod.stat().st_mtime_ns != prod_stamp or sch.stat().st_mtime_ns != sch_stamp:
            die("selftest: production file mtime changed")
        retired = work / "v1.00" / "board.kicad_pcb"
        retired.parent.mkdir()
        retired.write_text(TINY, encoding="utf-8")
        expect_exit(lambda: cmd_apply(retired, one), 2, "v1.00")
        quilt = work / "quilter-kicad8" / "board.kicad_pcb"
        quilt.parent.mkdir()
        quilt.write_text(TINY, encoding="utf-8")
        expect_exit(lambda: cmd_apply(quilt, one), 2, "quilter")
        easy = work / "EasyEDA.kicad_pcb"
        easy.write_text(TINY, encoding="utf-8")
        expect_exit(lambda: cmd_apply(easy, one), 2, "EasyEDA")
        held = work / "held.kicad_pcb"
        held.write_text(TINY, encoding="utf-8")
        (work / "~held.kicad_pcb.lck").write_text("lock", encoding="utf-8")
        before = held.read_bytes()
        expect_exit(lambda: cmd_apply(held, one), 2, "lock file")
        if held.read_bytes() != before:
            die("selftest: locked file was written")

        mod = OFFICIAL_FPS / "Package_TO_SOT_SMD.pretty" / "SOT-23.kicad_mod"
        if not mod.is_file():
            die(f"selftest: missing {mod}")
        live = work / "sot.kicad_pcb"
        live.write_text(
            fresh_board(embed_footprint(mod.read_text(encoding="utf-8"), "Package_TO_SOT_SMD:SOT-23", "Q1", Decimal(40), Decimal(30), Decimal(0))),
            encoding="utf-8",
        )
        front = work / "front.json"
        write_table(front, [{"ref": "Q1", "x": 55, "y": 22, "rot": 90, "side": "front"}])
        cmd_apply(live, front)
        cmd_check(live, front)
        pictures = work / "svg"
        cmd_picture(live, pictures)
        front_svg = (pictures / "F.Cu.svg").read_text(encoding="utf-8")
        pads = [(-0.9375, -0.95), (-0.9375, 0.95), (0.9375, 0.0)]
        rotated = [(py, -px) for px, py in pads]
        assert_geometry(front_svg, rotated, True)
        listed = io.StringIO()
        with contextlib.redirect_stdout(listed):
            cmd_list(live)
        if "Q1 55 22 90 front" not in listed.getvalue():
            die(f"selftest: list printed {listed.getvalue()!r}")
        front_body = footprint_text(live.read_text(encoding="utf-8"), "Q1")
        if "(at 0 -2.4 90)" not in front_body:
            die("selftest: SOT-23 reference did not rotate")
        if "(at 0 0 0)" not in front_body:
            die("selftest: SOT-23 user text stayed upside down")
        rear = work / "rear.json"
        write_table(rear, [{"ref": "Q1", "x": 55, "y": 22, "rot": 0, "side": "back"}])
        cmd_apply(live, rear)
        cmd_check(live, rear)
        q1 = dict(iter_footprints(parse(live.read_text(encoding="utf-8"))))["Q1"]
        if pad_numbers(q1, "1") != [Decimal("-0.9375"), Decimal("0.95")]:
            die(f"selftest: SOT-23 pad1 {pad_numbers(q1, '1')}")
        if side_of(q1) != "back":
            die("selftest: SOT-23 stayed on the front")
        same = live.read_text(encoding="utf-8")
        cmd_apply(live, rear)
        if live.read_text(encoding="utf-8") != same:
            die("selftest: SOT-23 second apply changed the file")
        cmd_picture(live, pictures)
        back_svg = (pictures / "B.Cu.svg").read_text(encoding="utf-8")
        mirrored = [(px, -py) for px, py in pads]
        assert_geometry(back_svg, mirrored, False)
        before = live.read_bytes()
        with tempfile.TemporaryDirectory(prefix="kicad-drc-") as drc_tmp:
            report = Path(drc_tmp) / "drc.json"
            proc = kicad(
                "pcb", "drc",
                "--severity-all",
                "--format", "json",
                "--exit-code-violations",
                "-o", str(report),
                str(live),
            )
            found, code = cli_report(report, proc.returncode, "pcb drc")
        if code != 0 or any(item.get("severity") == "error" for item in found):
            die(f"selftest: DRC failed {found[:6]}")
        if live.read_bytes() != before:
            die("selftest: DRC rewrote the board")
        if copper_counts(live.read_text(encoding="utf-8")) != (0, 0, 0):
            die("selftest: DRC added copper")
    print("selftest ok")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Place footprints on a KiCad 10 board")
    sub = parser.add_subparsers(dest="cmd", required=True)
    listing = sub.add_parser("list", help="print footprint positions from the board file")
    listing.add_argument("board", type=Path)
    check = sub.add_parser("check", help="compare a placement table to the board and the position file")
    check.add_argument("board", type=Path)
    check.add_argument("table", type=Path)
    apply = sub.add_parser("apply", help="move footprints named in a placement table")
    apply.add_argument("board", type=Path)
    apply.add_argument("table", type=Path)
    picture = sub.add_parser("picture", help="export F.Cu and B.Cu SVGs")
    picture.add_argument("board", type=Path)
    picture.add_argument("--out", type=Path, required=True)
    sub.add_parser("selftest", help="place a throwaway footprint and run it through kicad-cli")
    args = parser.parse_args()
    if args.cmd == "list":
        cmd_list(args.board)
    elif args.cmd == "check":
        cmd_check(args.board, args.table)
    elif args.cmd == "apply":
        cmd_apply(args.board, args.table)
    elif args.cmd == "picture":
        cmd_picture(args.board, args.out)
    elif args.cmd == "selftest":
        cmd_selftest()


if __name__ == "__main__":
    main()
