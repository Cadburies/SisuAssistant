#!/usr/bin/env python3
"""Find, build, and check KiCad 10 schematic symbols for the Sisu boards.

The pin grid, pin length, and property names live here so a skill does not
restate them. Usage is in MarineBoard/kicad-skills/README.md.
"""

from __future__ import annotations

import argparse
import contextlib
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

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_LIB = ROOT / "MarineBoard" / "Lib" / "Sisu.kicad_sym"
OFFICIAL_SYMS = Path(
    "/Applications/KiCad/KiCad.app/Contents/SharedSupport/symbols"
)
OFFICIAL_FPS = Path(
    "/Applications/KiCad/KiCad.app/Contents/SharedSupport/footprints"
)
KICAD_CLI = Path(
    os.environ.get(
        "KICAD_CLI",
        "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli",
    )
)

# A symbol placed on an otherwise empty sheet produces these. They mean the
# pins loaded. They do not mean the symbol is wrong.
LONE_SYMBOL_VIOLATIONS = {
    "pin_not_connected",
    "power_pin_not_driven",
    "lib_symbol_issues",
}

# sym-lib-table nicknames that differ from the file stem.
FILE_NICK = {"EasyEDA.kicad_sym": "LCSC"}
# fp-lib-table nicknames for project footprint dirs. The path is not the nickname.
PROJECT_PRETTIES = (
    (Path("MarineBoard/Lib/EasyEDA.pretty"), "LCSC"),
    (
        Path("MarineBoard/Lib/footprints/com_github_espressif_kicad-libraries/Espressif.pretty"),
        "PCM_Espressif",
    ),
)

PIN_TYPES = {
    "passive",
    "input",
    "output",
    "bidirectional",
    "tri_state",
    "power_in",
    "power_out",
    "open_collector",
    "open_emitter",
    "no_connect",
    "free",
    "unspecified",
}
SIDES = {"left", "right", "top", "bottom"}
# KiCad library convention S4.1: pin origins on a 100 mil grid, pin length 100 mil.
PIN_LEN = 100
GRID = 100

LIB_HEADER = """(kicad_symbol_lib
	(version 20251024)
	(generator "kicad_sym")
	(generator_version "10.0")
)
"""


class Node:
    def __init__(self, start, end, kind, value=None, children=None):
        self.start = start
        self.end = end
        self.kind = kind
        self.value = value
        self.children = children or []


def die(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(code)


def q(text: str) -> str:
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def unquote(raw: str) -> str:
    if len(raw) >= 2 and raw[0] == '"' and raw[-1] == '"':
        inner = raw[1:-1]
        out = []
        i = 0
        while i < len(inner):
            if inner[i] == "\\" and i + 1 < len(inner):
                out.append(inner[i + 1])
                i += 2
            else:
                out.append(inner[i])
                i += 1
        return "".join(out)
    return raw


def mm(mils: int) -> str:
    value = Decimal(mils) * Decimal("0.0254")
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def lex(text: str) -> list[Node]:
    toks = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c.isspace():
            i += 1
            continue
        if c in "()":
            toks.append(Node(i, i + 1, c, c))
            i += 1
            continue
        if c == '"':
            start = i
            i += 1
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == '"':
                    i += 1
                    break
                i += 1
            toks.append(Node(start, i, "str", text[start:i]))
            continue
        start = i
        while i < n and not text[i].isspace() and text[i] not in '()\"':
            i += 1
        toks.append(Node(start, i, "atom", text[start:i]))
    return toks


def parse(text: str) -> Node:
    toks = lex(text)

    def rec(i: int) -> tuple[Node, int]:
        tok = toks[i]
        if tok.kind != "(":
            return tok, i + 1
        start = tok.start
        i += 1
        children = []
        while i < len(toks) and toks[i].kind != ")":
            child, i = rec(i)
            children.append(child)
        if i >= len(toks):
            die("unclosed '(' in KiCad s-expression")
        end = toks[i].end
        return Node(start, end, "list", None, children), i + 1

    if not toks:
        die("empty KiCad file")
    tree, i = rec(0)
    if i != len(toks):
        die("trailing tokens after the top-level KiCad form")
    return tree


def head(node: Node) -> str | None:
    if node.kind == "list" and node.children:
        return node.children[0].value
    return None


def child(node: Node, name: str) -> Node | None:
    for c in node.children:
        if head(c) == name:
            return c
    return None


def atom_at(node: Node, index: int) -> str | None:
    if len(node.children) <= index:
        return None
    tok = node.children[index]
    if tok.kind == "list":
        return None
    return unquote(tok.value)


def symbol_name(node: Node) -> str | None:
    if head(node) != "symbol":
        return None
    return atom_at(node, 1)


def walk(node: Node):
    yield node
    for c in node.children:
        yield from walk(c)


def top_symbols(tree: Node) -> list[Node]:
    return [c for c in tree.children if symbol_name(c)]


def find_symbol(tree: Node, name: str) -> Node | None:
    for node in top_symbols(tree):
        if symbol_name(node) == name:
            return node
    return None


def pin_fields(pin: Node) -> dict:
    typ = atom_at(pin, 1) or ""
    at = child(pin, "at")
    length = child(pin, "length")
    name = child(pin, "name")
    number = child(pin, "number")
    coords = []
    if at is not None:
        coords = [atom_at(at, i) or "" for i in range(1, 4)]
    return {
        "type": typ,
        "at": coords,
        "length": atom_at(length, 1) if length is not None else "",
        "name": atom_at(name, 1) if name is not None else "",
        "number": atom_at(number, 1) if number is not None else "",
    }


def pins_of(sym: Node) -> list[dict]:
    found = []
    for node in walk(sym):
        if head(node) == "pin":
            found.append(pin_fields(node))
    return found


def extends_target(sym: Node) -> str | None:
    node = child(sym, "extends")
    if node is None:
        return None
    return atom_at(node, 1)


def resolved_pins(tree: Node, sym: Node, seen: set[str] | None = None) -> list[dict]:
    """Pins on this symbol, with a same-library ``(extends)`` parent filled in.

    A pin number written on the child replaces the parent pin with that number.
    Official parts such as ``2N3904`` store their pins only on the parent.
    """
    name = symbol_name(sym) or ""
    seen = set() if seen is None else set(seen)
    if name in seen:
        die(f"{name} extends itself")
    seen.add(name)
    own = pins_of(sym)
    parent_name = extends_target(sym)
    if not parent_name:
        return own
    if ":" in parent_name:
        die(f"{name} extends {parent_name} in another library")
    parent = find_symbol(tree, parent_name)
    if parent is None:
        die(f"{name} extends {parent_name}, which is not in this library")
    inherited = resolved_pins(tree, parent, seen)
    by_number = {pin["number"]: pin for pin in inherited}
    for pin in own:
        by_number[pin["number"]] = pin
    ordered = []
    seen_numbers = set()
    for pin in inherited + own:
        number = pin["number"]
        if number in seen_numbers:
            continue
        ordered.append(by_number[number])
        seen_numbers.add(number)
    return ordered


def inheritance_chain(tree: Node, sym: Node) -> list[Node]:
    """Root parent first, then each derived symbol, ending at ``sym``."""
    chain = []
    seen: set[str] = set()
    current = sym
    while True:
        name = symbol_name(current) or ""
        if name in seen:
            die(f"{name} extends itself")
        seen.add(name)
        chain.append(current)
        parent_name = extends_target(current)
        if not parent_name:
            break
        if ":" in parent_name:
            die(f"{name} extends {parent_name} in another library")
        parent = find_symbol(tree, parent_name)
        if parent is None:
            die(f"{name} extends {parent_name}, which is not in this library")
        current = parent
    chain.reverse()
    return chain


def prop_value(sym: Node, name: str) -> str:
    for node in sym.children:
        if head(node) == "property" and atom_at(node, 1) == name:
            return atom_at(node, 2) or ""
    return ""


def kicad(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess:
    if not KICAD_CLI.exists():
        die(f"kicad-cli not found at {KICAD_CLI}. Set KICAD_CLI.")
    return subprocess.run(
        [str(KICAD_CLI), *args],
        cwd=cwd,
        text=True,
        capture_output=True,
    )


def locked(path: Path) -> Path | None:
    lock = path.parent / f"~{path.name}.lck"
    return lock if lock.exists() else None


def protected(path: Path) -> str | None:
    resolved = path.resolve()
    parts = resolved.parts
    if "v1.00" in parts:
        return "v1.00 is the retired prototype"
    if any("quilter" in part.lower() for part in parts):
        return "a quilter copy is a KiCad 8 upload set; saving it in KiCad 10 upgrades the file"
    if resolved.name in {"MarineBoard.kicad_sch", "MarineBoard.kicad_pcb"} and resolved.parent.name == "MarineBoard":
        return "the production Marine Board schematic and board stay out of this script"
    return None


def refuse_write(path: Path) -> None:
    why = protected(path)
    if why:
        die(f"refusing to write {path}: {why}", 2)
    lock = locked(path)
    if lock:
        die(f"KiCad has {path.name} open ({lock.name}). Close it, then retry.", 2)
    if path.name.lower().startswith("easyeda"):
        die(f"refusing to write {path.name}. New symbols go in Lib/Sisu.kicad_sym.", 2)


def nick_for_sym_file(path: Path) -> str:
    return FILE_NICK.get(path.name, path.stem)


def project_pretty_dirs() -> list[tuple[Path, str]]:
    found = []
    for rel, nick in PROJECT_PRETTIES:
        path = ROOT / rel
        if path.is_dir():
            found.append((path, nick))
    return found


def table_nicks() -> set[str]:
    table = ROOT / "MarineBoard" / "sym-lib-table"
    if not table.exists():
        return set()
    return set(re.findall(r'\(name "([^"]+)"', table.read_text(encoding="utf-8")))


def iter_symbol_libs() -> list[Path]:
    libs = []
    if OFFICIAL_SYMS.is_dir():
        libs.extend(sorted(OFFICIAL_SYMS.glob("*.kicad_sym")))
    lib_dir = ROOT / "MarineBoard" / "Lib"
    if lib_dir.is_dir():
        libs.extend(sorted(p for p in lib_dir.rglob("*.kicad_sym") if "backup" not in p.parts))
    return libs


def symbol_names_in(text: str) -> set[str]:
    names = set()
    for quoted, bare in re.findall(r'\(symbol\s+(?:"([^"]+)"|([^\s()]+))', text):
        names.add(quoted or bare)
    drop = set()
    for name in names:
        match = re.fullmatch(r"(.+)_\d+_\d+", name)
        if match and match.group(1) in names:
            drop.add(name)
    return names - drop


def cmd_find(query: str, limit: int, footprints: bool) -> None:
    needle = query.lower()
    shown = 0
    if not footprints:
        nicks = table_nicks()
        for path in iter_symbol_libs():
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            nick = nick_for_sym_file(path)
            for name in sorted(symbol_names_in(text)):
                if needle in name.lower():
                    note = ""
                    if nick not in nicks and not str(path).startswith(str(OFFICIAL_SYMS)):
                        note = "  (file is not in MarineBoard/sym-lib-table)"
                    print(f"{nick}:{name}\t{path}{note}")
                    shown += 1
                    if shown >= limit:
                        return
        if shown == 0:
            die(f"no symbol name contains {query!r}")
        return

    if len(query) < 2:
        die("footprint search needs at least 2 characters")
    pretties = []
    if OFFICIAL_FPS.is_dir():
        pretties.extend((path, path.stem) for path in sorted(OFFICIAL_FPS.glob("*.pretty")))
    pretties.extend(project_pretty_dirs())
    for pretty, nick in pretties:
        for mod in sorted(pretty.glob("*.kicad_mod")):
            if needle in mod.stem.lower():
                print(f"{nick}:{mod.stem}\t{mod}")
                shown += 1
                if shown >= limit:
                    return
    if shown == 0:
        die(f"no footprint name contains {query!r}")


def resolve_symbol(spec: str) -> tuple[Path, str]:
    if ":" in spec and not spec.endswith(".kicad_sym"):
        nick, name = spec.split(":", 1)
        if nick and "/" not in nick:
            official = OFFICIAL_SYMS / f"{nick}.kicad_sym"
            if official.exists():
                return official, name
            for path in iter_symbol_libs():
                if nick_for_sym_file(path) == nick:
                    return path, name
            die(f"no library nicknamed {nick}")
    if ":" in spec:
        file_part, name = spec.rsplit(":", 1)
        path = Path(file_part)
        if not path.is_file():
            path = ROOT / file_part
        if path.is_file():
            return path, name
    die(f"give a symbol as Library:Name or path/lib.kicad_sym:Name, not {spec!r}")
    raise AssertionError


def cmd_show(spec: str) -> None:
    path, name = resolve_symbol(spec)
    tree = parse(path.read_text(encoding="utf-8"))
    sym = find_symbol(tree, name)
    if sym is None:
        die(f"{name} is not a top-level symbol in {path}")
    pins = resolved_pins(tree, sym)
    print(f"{nick_for_sym_file(path)}:{name}  {path}")
    ref = prop_value(sym, "Reference")
    value = prop_value(sym, "Value")
    footprint = prop_value(sym, "Footprint")
    print(f"reference {ref}  value {value}  footprint {footprint or '(empty)'}")
    parent_name = extends_target(sym)
    if parent_name:
        print(f"extends {parent_name}")
    print(f"pins {len(pins)}")
    for pin in pins:
        at = " ".join(pin["at"])
        print(
            f"  {pin['number']:>4}  {pin['name']:<24}  {pin['type']:<16}  "
            f"at {at}  length {pin['length']}"
        )


def resolve_footprint(spec: str) -> Path:
    if spec.endswith(".kicad_mod"):
        path = Path(spec)
        return path if path.is_file() else ROOT / spec
    if ":" not in spec:
        die(f"give a footprint as Library:Name or a .kicad_mod path, not {spec!r}")
    nick, name = spec.split(":", 1)
    candidates = []
    if OFFICIAL_FPS.is_dir():
        candidates.append(OFFICIAL_FPS / f"{nick}.pretty" / f"{name}.kicad_mod")
    for folder, mapped in project_pretty_dirs():
        if mapped == nick:
            candidates.append(folder / f"{name}.kicad_mod")
    for path in candidates:
        if path.is_file():
            return path
    die(f"footprint file not found for {spec}")
    raise AssertionError


def pad_numbers(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    pads = []
    for match in re.finditer(r'\(pad\s+(?:"([^"]*)"|([^\s()]+))', text):
        pads.append(match.group(1) if match.group(1) is not None else match.group(2))
    return pads


def named_pads(path: Path) -> tuple[list[str], int]:
    pads = pad_numbers(path)
    named = [pad for pad in pads if pad]
    return named, len(pads) - len(named)


def cmd_pads(spec: str) -> None:
    path = resolve_footprint(spec)
    if not path.is_file():
        die(f"no footprint file {path}")
    named, blank = named_pads(path)
    print(f"{spec}  {path}")
    print("pads " + " ".join(named))
    if blank:
        print(f"unnamed pads {blank}")


def cmd_match(symbol_spec: str, footprint_spec: str) -> None:
    path, name = resolve_symbol(symbol_spec)
    tree = parse(path.read_text(encoding="utf-8"))
    sym = find_symbol(tree, name)
    if sym is None:
        die(f"{name} is not in {path}")
    pins = [p["number"] for p in resolved_pins(tree, sym)]
    fp = resolve_footprint(footprint_spec)
    pads, blank = named_pads(fp)
    pin_set = set(pins)
    pad_set = set(pads)
    missing = sorted(pin_set - pad_set, key=str)
    extra = sorted(pad_set - pin_set, key=str)
    print(f"symbol pins {len(pins)}: {' '.join(pins)}")
    print(f"footprint pads {len(pads)}: {' '.join(pads)}")
    if blank:
        print(f"unnamed pads {blank}")
    if missing:
        die("pads missing for symbol pins: " + " ".join(missing))
    if extra:
        print("pads with no symbol pin: " + " ".join(extra))
    else:
        print("pin numbers and pad numbers match")


def display_name(pin: dict) -> str:
    name = str(pin["name"]).strip()
    if "\n" in name or "\r" in name:
        die(f"pin {pin.get('number')} name has a newline")
    if name.startswith("~{") and name.endswith("}"):
        return name
    if not pin.get("active_low"):
        return name
    for prefix in ("~", "#", "/"):
        if name.startswith(prefix) and len(name) > len(prefix):
            name = name[len(prefix):]
            break
    # A datasheet writes nRESET for an active-low RESET. NSS, NMI and NC keep the N.
    if len(name) > 1 and name[0] == "n" and name[1].isupper():
        name = name[1:]
    return "~{" + name + "}"


def validate(spec: dict) -> list[str]:
    errors = []
    if not isinstance(spec, dict):
        return ["pin table must be a JSON object"]
    kind = spec.get("kind", "part")
    name = spec.get("name", "")
    if kind == "power":
        name_ok = isinstance(name, str) and re.fullmatch(r"\+[A-Za-z0-9_+\-.]+|[A-Za-z][A-Za-z0-9_+\-.]*", name)
    else:
        name_ok = isinstance(name, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_+\-.]*", name)
    if not name_ok:
        errors.append(f"name must be a KiCad symbol name like PC817 or +12V_FILT, got {name!r}")
    if kind == "power":
        if spec.get("pins"):
            errors.append("a power symbol has no pins list; the script draws the one power pin")
        return errors
    if kind != "part":
        errors.append(f"kind must be 'part' or 'power', got {kind!r}")
    ref = spec.get("reference", "")
    if not isinstance(ref, str) or not re.fullmatch(r"[A-Z]+", ref):
        errors.append(f"reference must be letters like U or J, got {ref!r}")
    pins = spec.get("pins")
    if not isinstance(pins, list) or not pins:
        errors.append("pins must be a non-empty list")
        return errors
    seen = set()
    for pin in pins:
        if not isinstance(pin, dict):
            errors.append("each pin must be an object")
            continue
        number = str(pin.get("number", ""))
        if not re.fullmatch(r"[A-Za-z0-9]+", number):
            errors.append(f"pin number {number!r} must be letters and digits")
        elif number in seen:
            errors.append(f"pin number {number} is repeated")
        seen.add(number)
        if pin.get("side") not in SIDES:
            errors.append(f"pin {number} side must be one of {sorted(SIDES)}")
        if pin.get("type") not in PIN_TYPES:
            errors.append(f"pin {number} type must be one of {sorted(PIN_TYPES)}")
        if not str(pin.get("name", "")).strip():
            errors.append(f"pin {number} needs a name")
    return errors


def side_coords(count: int) -> list[int]:
    """Positions on a 100 mil grid, high coordinate first.

    Left and right use this as Y, so the first pin is the top one. KiCad Y
    grows upward. An even count is one step off center so every pin stays
    on the grid.
    """
    if count == 0:
        return []
    top = ((count - 1) // 2) * GRID
    return [top - i * GRID for i in range(count)]


def name_span(pins: list[dict]) -> int:
    if not pins:
        return 0
    longest = max(len(display_name(p)) for p in pins)
    return longest * 50 + 50


def round_up(value: int, step: int) -> int:
    return ((value + step - 1) // step) * step


def layout_part(spec: dict) -> dict:
    groups = {side: [] for side in SIDES}
    for pin in spec["pins"]:
        groups[pin["side"]].append(pin)
    ys_l = side_coords(len(groups["left"]))
    ys_r = side_coords(len(groups["right"]))
    # X grows to the right. Reverse the high-first list so the first pin is the left one.
    xs_t = list(reversed(side_coords(len(groups["top"]))))
    xs_b = list(reversed(side_coords(len(groups["bottom"]))))
    width = name_span(groups["left"]) + name_span(groups["right"]) + 100
    for xs in (xs_t, xs_b):
        if xs:
            width = max(width, max(abs(x) for x in xs) * 2 + 200)
    width = max(400, round_up(width, 200))
    half_w = width // 2
    ys = ys_l + ys_r
    height = (max(abs(y) for y in ys) + GRID) * 2 if ys else 200
    height = max(200, round_up(height, 200))
    half_h = height // 2
    placed = []
    for pin, y in zip(groups["left"], ys_l):
        placed.append((pin, -half_w - PIN_LEN, y, 0))
    for pin, y in zip(groups["right"], ys_r):
        placed.append((pin, half_w + PIN_LEN, y, 180))
    for pin, x in zip(groups["top"], xs_t):
        placed.append((pin, x, half_h + PIN_LEN, 270))
    for pin, x in zip(groups["bottom"], xs_b):
        placed.append((pin, x, -half_h - PIN_LEN, 90))
    ref_y = half_h + (200 if groups["top"] else 100)
    val_y = -(half_h + (200 if groups["bottom"] else 100))
    return {
        "placed": placed,
        "half_w": half_w,
        "half_h": half_h,
        "ref_y": ref_y,
        "val_y": val_y,
    }


def prop(name: str, value: str, x: int, y: int, hide: bool = False) -> str:
    hide_line = "\n\t\t\t(hide yes)" if hide else ""
    return (
        f"\t\t(property {q(name)} {q(value)}\n"
        f"\t\t\t(at {mm(x)} {mm(y)} 0)\n"
        f"\t\t\t(show_name no)\n"
        f"\t\t\t(do_not_autoplace no)"
        f"{hide_line}\n"
        f"\t\t\t(effects\n"
        f"\t\t\t\t(font\n"
        f"\t\t\t\t\t(size 1.27 1.27)\n"
        f"\t\t\t\t)\n"
        f"\t\t\t)\n"
        f"\t\t)"
    )


def pin_block(pin: dict, x: int, y: int, angle: int) -> str:
    return (
        f"\t\t\t(pin {pin['type']} line\n"
        f"\t\t\t\t(at {mm(x)} {mm(y)} {angle})\n"
        f"\t\t\t\t(length {mm(PIN_LEN)})\n"
        f"\t\t\t\t(name {q(display_name(pin))}\n"
        f"\t\t\t\t\t(effects\n"
        f"\t\t\t\t\t\t(font\n"
        f"\t\t\t\t\t\t\t(size 1.27 1.27)\n"
        f"\t\t\t\t\t\t)\n"
        f"\t\t\t\t\t)\n"
        f"\t\t\t\t)\n"
        f"\t\t\t\t(number {q(str(pin['number']))}\n"
        f"\t\t\t\t\t(effects\n"
        f"\t\t\t\t\t\t(font\n"
        f"\t\t\t\t\t\t\t(size 1.27 1.27)\n"
        f"\t\t\t\t\t\t)\n"
        f"\t\t\t\t\t)\n"
        f"\t\t\t\t)\n"
        f"\t\t\t)"
    )


def flags(in_bom: bool) -> str:
    bom = "yes" if in_bom else "no"
    board = "yes" if in_bom else "no"
    return (
        "\t\t(exclude_from_sim no)\n"
        f"\t\t(in_bom {bom})\n"
        f"\t\t(on_board {board})\n"
        f"\t\t(in_pos_files {board})\n"
        "\t\t(duplicate_pin_numbers_are_jumpers no)"
    )


def render_part(spec: dict) -> str:
    lay = layout_part(spec)
    name = spec["name"]
    value = spec.get("value") or name
    pins = "\n".join(pin_block(pin, x, y, angle) for pin, x, y, angle in lay["placed"])
    keywords = spec.get("keywords") or ""
    body = (
        f"\t(symbol {q(name)}\n"
        f"\t\t(pin_names\n"
        f"\t\t\t(offset 0.254)\n"
        f"\t\t)\n"
        f"{flags(True)}\n"
        f"{prop('Reference', spec['reference'], 0, lay['ref_y'])}\n"
        f"{prop('Value', value, 0, lay['val_y'])}\n"
        f"{prop('Footprint', spec.get('footprint') or '', 0, 0, True)}\n"
        f"{prop('Datasheet', spec.get('datasheet') or '', 0, 0, True)}\n"
        f"{prop('Description', spec.get('description') or '', 0, 0, True)}\n"
        f"{prop('MPN', spec.get('mpn') or '', 0, 0, True)}\n"
        f"{prop('Manufacturer', spec.get('manufacturer') or '', 0, 0, True)}\n"
        f"{prop('ki_keywords', keywords, 0, 0, True)}\n"
        f"\t\t(symbol {q(name + '_0_1')}\n"
        f"\t\t\t(rectangle\n"
        f"\t\t\t\t(start {mm(-lay['half_w'])} {mm(lay['half_h'])})\n"
        f"\t\t\t\t(end {mm(lay['half_w'])} {mm(-lay['half_h'])})\n"
        f"\t\t\t\t(stroke\n"
        f"\t\t\t\t\t(width 0.254)\n"
        f"\t\t\t\t\t(type default)\n"
        f"\t\t\t\t)\n"
        f"\t\t\t\t(fill\n"
        f"\t\t\t\t\t(type background)\n"
        f"\t\t\t\t)\n"
        f"\t\t\t)\n"
        f"\t\t)\n"
        f"\t\t(symbol {q(name + '_1_1')}\n"
        f"{pins}\n"
        f"\t\t)\n"
        f"\t\t(embedded_fonts no)\n"
        f"\t)"
    )
    return body


def render_power(spec: dict) -> str:
    name = spec["name"]
    # Same arrow as the official +12V symbol: the wire attaches at 0,0.
    return (
        f"\t(symbol {q(name)}\n"
        f"\t\t(power global)\n"
        f"\t\t(pin_numbers\n"
        f"\t\t\t(hide yes)\n"
        f"\t\t)\n"
        f"\t\t(pin_names\n"
        f"\t\t\t(offset 0)\n"
        f"\t\t\t(hide yes)\n"
        f"\t\t)\n"
        f"{flags(False)}\n"
        f"{prop('Reference', '#PWR', 0, -150, True)}\n"
        f"{prop('Value', name, 0, 140)}\n"
        f"{prop('Footprint', '', 0, 0, True)}\n"
        f"{prop('Datasheet', '', 0, 0, True)}\n"
        f"{prop('Description', 'Power symbol creates a global label with name ' + name, 0, 0, True)}\n"
        f"{prop('ki_keywords', 'global power', 0, 0, True)}\n"
        f"\t\t(symbol {q(name + '_0_1')}\n"
        f"\t\t\t(polyline\n"
        f"\t\t\t\t(pts\n"
        f"\t\t\t\t\t(xy -0.762 1.27) (xy 0 2.54)\n"
        f"\t\t\t\t)\n"
        f"\t\t\t\t(stroke (width 0) (type default))\n"
        f"\t\t\t\t(fill (type none))\n"
        f"\t\t\t)\n"
        f"\t\t\t(polyline\n"
        f"\t\t\t\t(pts\n"
        f"\t\t\t\t\t(xy 0 2.54) (xy 0.762 1.27)\n"
        f"\t\t\t\t)\n"
        f"\t\t\t\t(stroke (width 0) (type default))\n"
        f"\t\t\t\t(fill (type none))\n"
        f"\t\t\t)\n"
        f"\t\t\t(polyline\n"
        f"\t\t\t\t(pts\n"
        f"\t\t\t\t\t(xy 0 0) (xy 0 2.54)\n"
        f"\t\t\t\t)\n"
        f"\t\t\t\t(stroke (width 0) (type default))\n"
        f"\t\t\t\t(fill (type none))\n"
        f"\t\t\t)\n"
        f"\t\t)\n"
        f"\t\t(symbol {q(name + '_1_1')}\n"
        f"\t\t\t(pin power_in line\n"
        f"\t\t\t\t(at 0 0 90)\n"
        f"\t\t\t\t(length 0)\n"
        f"\t\t\t\t(name {q('')}\n"
        f"\t\t\t\t\t(effects (font (size 1.27 1.27)))\n"
        f"\t\t\t\t)\n"
        f"\t\t\t\t(number {q('1')}\n"
        f"\t\t\t\t\t(effects (font (size 1.27 1.27)))\n"
        f"\t\t\t\t)\n"
        f"\t\t\t)\n"
        f"\t\t)\n"
        f"\t\t(embedded_fonts no)\n"
        f"\t)"
    )


def render(spec: dict) -> str:
    if spec.get("kind") == "power":
        return render_power(spec)
    return render_part(spec)


def load_table(path: Path) -> dict:
    try:
        spec = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        die(f"{path}: {exc}")
    errors = validate(spec)
    if errors:
        die(path.name + ":\n" + "\n".join(errors))
    return spec


def upsert(text: str, name: str, symbol_text: str) -> str:
    if not text.strip():
        text = LIB_HEADER
    tree = parse(text)
    if head(tree) != "kicad_symbol_lib":
        die("library does not start with kicad_symbol_lib")
    existing = find_symbol(tree, name)
    block = symbol_text
    if not block.endswith("\n"):
        block += "\n"
    if existing is not None:
        return text[: existing.start] + block.rstrip("\n") + text[existing.end :]
    close = tree.end - 1
    return text[:close] + "\n" + block + text[close:]


def cmd_build(table: Path, lib: Path) -> None:
    refuse_write(lib)
    spec = load_table(table)
    text = lib.read_text(encoding="utf-8") if lib.exists() else LIB_HEADER
    lib.parent.mkdir(parents=True, exist_ok=True)
    lib.write_text(upsert(text, spec["name"], render(spec)), encoding="utf-8")
    print(f"wrote {spec['name']} to {lib}")
    if lib.resolve() == DEFAULT_LIB.resolve():
        if "Sisu" not in table_nicks():
            print(
                "MarineBoard/sym-lib-table has no Sisu row. With KiCad closed, add:\n"
                '(lib (name "Sisu")(type "KiCad")(uri "${KIPRJMOD}/Lib/Sisu.kicad_sym")'
                '(options "")(descr "Symbols drawn for Sisu boards"))'
            )


def on_grid(text: str) -> bool:
    try:
        value = Decimal(text)
    except Exception:
        return False
    return value % Decimal("2.54") == 0


def violations(report: dict) -> list[dict]:
    found = []

    def walk_json(node):
        if isinstance(node, dict):
            if "severity" in node and "type" in node:
                found.append(node)
            for value in node.values():
                walk_json(value)
        elif isinstance(node, list):
            for value in node:
                walk_json(value)

    walk_json(report)
    return found


def rename_symbol(sexpr: str, old: str, new: str) -> str:
    """Rename the top symbol to Library:Name. Unit bodies stay Name_0_1.

    KiCad stores the cache entry as ``Library:Name`` and the units as
    ``Name_0_1``. Renaming the units too makes the schematic fail to load.
    """
    tree = parse(sexpr)
    if symbol_name(tree) != old:
        die(f"expected symbol {old} at the top of the excerpt")
    tok = tree.children[1]
    return sexpr[: tok.start] + q(new) + sexpr[tok.end :]


def retarget_extends(sexpr: str, new_parent: str) -> str:
    """Point a cache entry at ``Library:Parent``. Units stay unprefixed."""
    tree = parse(sexpr)
    node = child(tree, "extends")
    if node is None:
        return sexpr
    tok = node.children[1]
    return sexpr[: tok.start] + q(new_parent) + sexpr[tok.end :]


def next_ref(text: str, prefix: str) -> str:
    used = set(re.findall(r'\(reference "([^"]+)"', text))
    if prefix == "#PWR":
        n = 1
        while f"#PWR{n:02d}" in used:
            n += 1
        return f"#PWR{n:02d}"
    n = 1
    while f"{prefix}{n}" in used:
        n += 1
    return f"{prefix}{n}"


def instance_block(
    lib_id: str,
    sym: Node,
    ref: str,
    at: tuple[str, str],
    project: str,
    root: str,
    pins: list[dict],
) -> str:
    x, y = at
    in_bom = "no" if prop_value(sym, "Reference") == "#PWR" else "yes"
    lines = [
        "\t(symbol",
        f"\t\t(lib_id {q(lib_id)})",
        f"\t\t(at {x} {y} 0)",
        "\t\t(unit 1)",
        "\t\t(body_style 1)",
        "\t\t(exclude_from_sim no)",
        f"\t\t(in_bom {in_bom})",
        f"\t\t(on_board {in_bom})",
        f"\t\t(in_pos_files {in_bom})",
        "\t\t(dnp no)",
        f'\t\t(uuid "{uuid.uuid4()}")',
    ]
    fields = [
        ("Reference", ref, False),
        ("Value", prop_value(sym, "Value"), False),
        ("Footprint", prop_value(sym, "Footprint"), True),
        ("Datasheet", prop_value(sym, "Datasheet"), True),
        ("Description", prop_value(sym, "Description"), True),
        ("MPN", prop_value(sym, "MPN"), True),
        ("Manufacturer", prop_value(sym, "Manufacturer"), True),
    ]
    for fname, fval, hide in fields:
        if fname in {"MPN", "Manufacturer"} and not fval:
            continue
        hidden = hide or (fname == "Reference" and ref.startswith("#PWR"))
        hide_line = "\n\t\t\t(hide yes)" if hidden else ""
        lines.append(
            f"\t\t(property {q(fname)} {q(fval)}\n"
            f"\t\t\t(at {x} {y} 0)\n"
            f"\t\t\t(show_name no)\n"
            f"\t\t\t(do_not_autoplace no)"
            f"{hide_line}\n"
            f"\t\t\t(effects (font (size 1.27 1.27)))\n"
            f"\t\t)"
        )
    for pin in pins:
        lines.append(f'\t\t(pin {q(pin["number"])}\n\t\t\t(uuid "{uuid.uuid4()}")\n\t\t)')
    lines.append(
        "\t\t(instances\n"
        f"\t\t\t(project {q(project)}\n"
        f'\t\t\t\t(path "/{root}"\n'
        f"\t\t\t\t\t(reference {q(ref)})\n"
        f"\t\t\t\t\t(unit 1)\n"
        f"\t\t\t\t)\n"
        f"\t\t\t)\n"
        f"\t\t)"
    )
    lines.append("\t)")
    return "\n".join(lines)


def fresh_schematic() -> str:
    return (
        "(kicad_sch\n"
        "\t(version 20260306)\n"
        '\t(generator "kicad_sym")\n'
        '\t(generator_version "10.0")\n'
        f'\t(uuid "{uuid.uuid4()}")\n'
        '\t(paper "A4")\n'
        "\t(lib_symbols)\n"
        "\t(sheet_instances\n"
        '\t\t(path "/"\n'
        '\t\t\t(page "1")\n'
        "\t\t)\n"
        "\t)\n"
        "\t(embedded_fonts no)\n"
        ")\n"
    )


def cmd_place(lib: Path, name: str, sch: Path, at: str) -> None:
    refuse_write(sch)
    try:
        x_text, y_text = at.split(",")
        x_val, y_val = Decimal(x_text), Decimal(y_text)
    except Exception:
        die("--at must be x,y in millimetres, for example 127,127")
    if x_val % Decimal("1.27") != 0 or y_val % Decimal("1.27") != 0:
        die("--at must sit on a 1.27 mm grid so a wire can meet the pin")
    if not lib.is_file():
        die(f"no library {lib}")
    lib_text = lib.read_text(encoding="utf-8")
    lib_tree = parse(lib_text)
    sym = find_symbol(lib_tree, name)
    if sym is None:
        die(f"{name} is not in {lib}")
    sch_text = sch.read_text(encoding="utf-8") if sch.exists() else fresh_schematic()
    sch_tree = parse(sch_text)
    if head(sch_tree) != "kicad_sch":
        die(f"{sch} is not a kicad_sch")
    root_match = re.search(r'\(uuid "([0-9a-fA-F-]{36})"', sch_text)
    if not root_match:
        die(f"{sch} has no root uuid")
    root = root_match.group(1)
    project = sch.stem
    sibling = sch.with_suffix(".kicad_pro")
    if sibling.exists():
        project = sibling.stem
    nick = nick_for_sym_file(lib)
    lib_id = f"{nick}:{name}"
    libs = None
    for node in sch_tree.children:
        if head(node) == "lib_symbols":
            libs = node
            break
    if libs is None:
        die(f"{sch} has no lib_symbols list")
    present = {symbol_name(c) for c in libs.children}
    blocks = []
    for node in inheritance_chain(lib_tree, sym):
        part = symbol_name(node) or ""
        embedded_id = f"{nick}:{part}"
        if embedded_id in present:
            continue
        excerpt = rename_symbol(lib_text[node.start : node.end], part, embedded_id)
        parent_name = extends_target(node)
        if parent_name:
            excerpt = retarget_extends(excerpt, f"{nick}:{parent_name}")
        blocks.append(excerpt)
        present.add(embedded_id)
    if blocks:
        close = libs.end - 1
        sch_text = sch_text[:close] + "\n" + "\n".join(blocks) + "\n" + sch_text[close:]
        sch_tree = parse(sch_text)
    ref_prefix = prop_value(sym, "Reference") or "U"
    ref = next_ref(sch_text, ref_prefix)
    pins = resolved_pins(lib_tree, sym)
    block = instance_block(
        lib_id, sym, ref, (format(x_val, "f"), format(y_val, "f")), project, root, pins
    )
    sheet = None
    for node in sch_tree.children:
        if head(node) == "sheet_instances":
            sheet = node
            break
    if sheet is None:
        die(f"{sch} has no sheet_instances list")
    sch_text = sch_text[: sheet.start] + block + "\n" + sch_text[sheet.start :]
    sch.parent.mkdir(parents=True, exist_ok=True)
    sch.write_text(sch_text, encoding="utf-8")
    print(f"placed {lib_id} as {ref} at {x_val},{y_val} on {sch}")


def export_svg(lib: Path, name: str, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    proc = kicad(
        "sym", "export", "svg",
        "-o", str(out_dir),
        "--symbol", name,
        str(lib),
    )
    if proc.returncode != 0:
        die(f"kicad-cli sym export svg failed:\n{proc.stdout}\n{proc.stderr}")
    svgs = list(out_dir.glob("*.svg"))
    if not svgs:
        die(f"kicad-cli wrote no SVG in {out_dir}")
    return svgs[0]


def erc_lone_symbol(lib: Path, name: str, work: Path) -> list[dict]:
    work.mkdir(parents=True, exist_ok=True)
    sch = work / "lone.kicad_sch"
    sch.write_text(fresh_schematic(), encoding="utf-8")
    cmd_place(lib, name, sch, "127,127")
    report = work / "erc.json"
    proc = kicad(
        "sch", "erc",
        "--severity-all",
        "--format", "json",
        "-o", str(report),
        str(sch),
    )
    if proc.returncode != 0:
        detail = proc.stderr or proc.stdout
        die(f"kicad-cli sch erc could not read the symbol:\n{detail}")
    if not report.exists():
        die("kicad-cli sch erc wrote no report")
    return violations(json.loads(report.read_text(encoding="utf-8")))


def cmd_check(lib: Path, name: str) -> None:
    if not lib.is_file():
        die(f"no library {lib}")
    tree = parse(lib.read_text(encoding="utf-8"))
    sym = find_symbol(tree, name)
    if sym is None:
        die(f"{name} is not in {lib}")
    pins = resolved_pins(tree, sym)
    numbers = [p["number"] for p in pins]
    if len(numbers) != len(set(numbers)):
        die(f"repeated pin numbers in {name}: {' '.join(numbers)}")
    bad_types = sorted({p["type"] for p in pins if p["type"] not in PIN_TYPES})
    if bad_types:
        die(f"unknown pin types: {' '.join(bad_types)}")
    off = [
        p["number"]
        for p in pins
        if len(p["at"]) < 2 or not on_grid(p["at"][0]) or not on_grid(p["at"][1])
    ]
    with tempfile.TemporaryDirectory(prefix="kicad-sym-") as tmp:
        work = Path(tmp)
        upgraded = work / lib.name
        proc = kicad("sym", "upgrade", "--force", "-o", str(upgraded), str(lib))
        if proc.returncode != 0 or not upgraded.is_file():
            die(f"kicad-cli sym upgrade failed:\n{proc.stderr or proc.stdout}")
        svg = export_svg(upgraded, name, work / "svg")
        print(f"svg {svg} ({svg.stat().st_size} bytes)")
        found = erc_lone_symbol(upgraded, name, work)
    unexpected = [
        v for v in found
        if v.get("severity") == "error" and v.get("type") not in LONE_SYMBOL_VIOLATIONS
    ]
    print(f"erc on a lone {name}: {len(found)} violation(s), {len(unexpected)} unexpected error(s)")
    for item in found[:12]:
        print(f"  {item.get('severity')} {item.get('type')}: {item.get('description', '')}")
    if len(found) > 12:
        print(f"  {len(found) - 12} more")
    if off:
        die("pins off the 2.54 mm grid: " + " ".join(off))
    if unexpected:
        die("ERC reported an error that a lone symbol should not produce. The pin types or the file are wrong.")
    if not pins:
        die(f"{name} has no pins")
    print(f"{name} opens in KiCad. Unconnected pins on this lone copy are expected.")


def collect_violations_file(path: Path) -> list[dict]:
    return violations(json.loads(path.read_text(encoding="utf-8")))


def cli_report(report: Path, code: int, what: str) -> tuple[list[dict], int]:
    """Parse a kicad-cli JSON report.

    ``--exit-code-violations`` returns 5 when the report has violations.
    No report file means the command did not run.
    """
    if not report.is_file():
        die(f"kicad-cli {what} wrote no report (exit {code})")
    try:
        found = collect_violations_file(report)
    except json.JSONDecodeError:
        die(f"kicad-cli {what} wrote a report that is not JSON (exit {code})")
    if code == 0:
        return found, 0
    if not found:
        die(f"kicad-cli {what} failed to run (exit {code})")
    return found, code


def cmd_project_check(sch: Path, pcb: Path | None) -> None:
    if not sch.is_file():
        die(f"no schematic {sch}")
    with tempfile.TemporaryDirectory(prefix="kicad-erc-") as tmp:
        report = Path(tmp) / "erc.json"
        proc = kicad(
            "sch", "erc",
            "--severity-all",
            "--format", "json",
            "--exit-code-violations",
            "-o", str(report),
            str(sch),
        )
        found, erc_code = cli_report(report, proc.returncode, "sch erc")
        errors = [v for v in found if v.get("severity") == "error"]
        warnings = [v for v in found if v.get("severity") != "error"]
        print(f"erc {sch.name}: {len(errors)} error, {len(warnings)} warning (exit {proc.returncode})")
        for item in found[:20]:
            print(f"  {item.get('severity')} {item.get('type')}: {item.get('description', '')}")
        drc_code = 0
        if pcb is not None:
            if not pcb.is_file():
                die(f"no board {pcb}")
            drc_report = Path(tmp) / "drc.json"
            drc = kicad(
                "pcb", "drc",
                "--severity-all",
                "--schematic-parity",
                "--format", "json",
                "--exit-code-violations",
                "-o", str(drc_report),
                str(pcb),
            )
            drc_found, drc_code = cli_report(drc_report, drc.returncode, "pcb drc")
            d_err = [v for v in drc_found if v.get("severity") == "error"]
            d_warn = [v for v in drc_found if v.get("severity") != "error"]
            print(f"drc {pcb.name}: {len(d_err)} error, {len(d_warn)} warning (exit {drc.returncode})")
            for item in drc_found[:20]:
                print(f"  {item.get('severity')} {item.get('type')}: {item.get('description', '')}")
    if erc_code != 0 or drc_code != 0:
        raise SystemExit(1)


def assert_grid(lib: Path, name: str) -> None:
    tree = parse(lib.read_text(encoding="utf-8"))
    sym = find_symbol(tree, name)
    if sym is None:
        die(f"selftest: {name} missing")
    for pin in pins_of(sym):
        if len(pin["at"]) < 2 or not on_grid(pin["at"][0]) or not on_grid(pin["at"][1]):
            die(f"selftest: pin {pin['number']} off grid at {pin['at']}")
        if pin["length"] not in {"2.54", "0"}:
            die(f"selftest: pin {pin['number']} length {pin['length']}")


def cmd_selftest() -> None:
    example = Path(__file__).resolve().parents[1] / "create-symbol" / "examples" / "selftest-opto.json"
    spec = load_table(example)
    bad = json.loads(example.read_text(encoding="utf-8"))
    bad["pins"].append(dict(bad["pins"][0]))
    errors = validate(bad)
    if not any("repeated" in e for e in errors):
        die("selftest: duplicate pin number was accepted")

    with tempfile.TemporaryDirectory(prefix="kicad-selftest-") as tmp:
        work = Path(tmp)
        lib = work / "Sisu.kicad_sym"
        cmd_build(example, lib)
        cmd_build(example, lib)
        names = [symbol_name(node) for node in top_symbols(parse(lib.read_text(encoding="utf-8")))]
        if names.count(spec["name"]) != 1:
            die(f"selftest: rebuild duplicated the symbol: {names}")
        assert_grid(lib, spec["name"])
        power = work / "power.json"
        power.write_text(json.dumps({"kind": "power", "name": "+12V_FILT"}), encoding="utf-8")
        cmd_build(power, lib)
        upgraded = work / "up.kicad_sym"
        proc = kicad("sym", "upgrade", "--force", "-o", str(upgraded), str(lib))
        if proc.returncode != 0 or not upgraded.is_file():
            die(f"selftest upgrade failed:\n{proc.stderr or proc.stdout}")
        svg = export_svg(upgraded, spec["name"], work / "svg")
        if svg.stat().st_size < 100:
            die("selftest: svg is empty")
        export_svg(upgraded, "+12V_FILT", work / "svg-pwr")
        found = erc_lone_symbol(upgraded, spec["name"], work / "erc")
        kinds = [v.get("type") for v in found]
        if kinds.count("pin_not_connected") < 4:
            die(f"selftest: expected four unconnected pins, got {kinds}")
        power_found = erc_lone_symbol(upgraded, "+12V_FILT", work / "erc-pwr")
        power_bad = [
            v for v in power_found
            if v.get("severity") == "error" and v.get("type") not in LONE_SYMBOL_VIOLATIONS
        ]
        if power_bad:
            die(f"selftest: power symbol ERC errors {power_bad}")
        if display_name({"name": "nRESET", "number": "1", "active_low": True}) != "~{RESET}":
            die("selftest: active-low name")
        if display_name({"name": "NSS", "number": "1", "active_low": True}) != "~{NSS}":
            die("selftest: NSS kept its N")
        if display_name({"name": "NC", "number": "1", "active_low": True}) != "~{NC}":
            die("selftest: NC kept its N")
        if display_name({"name": "A", "number": "1"}) != "A":
            die("selftest: plain pin name")
        order = layout_part({
            "pins": [
                {"number": "1", "name": "VCC", "side": "top", "type": "power_in"},
                {"number": "2", "name": "AVCC", "side": "top", "type": "power_in"},
                {"number": "3", "name": "GND", "side": "bottom", "type": "power_in"},
                {"number": "4", "name": "AGND", "side": "bottom", "type": "power_in"},
                {"number": "5", "name": "IN", "side": "left", "type": "input"},
                {"number": "6", "name": "EN", "side": "left", "type": "input"},
                {"number": "7", "name": "OUT", "side": "right", "type": "output"},
                {"number": "8", "name": "OUT2", "side": "right", "type": "output"},
            ]
        })
        at = {pin["number"]: (x, y) for pin, x, y, _angle in order["placed"]}
        if not (at["1"][0] < at["2"][0] and at["3"][0] < at["4"][0]):
            die(f"selftest: top and bottom pins are not left to right: {at}")
        if not (at["5"][1] > at["6"][1] and at["7"][1] > at["8"][1]):
            die(f"selftest: left and right pins are not top to bottom: {at}")
        off_body = render_part({
            "name": "OffGrid",
            "reference": "U",
            "value": "OffGrid",
            "pins": [{"number": "1", "name": "A", "side": "left", "type": "passive"}],
        })
        off_body = off_body.replace(
            "(pin passive line\n\t\t\t\t(at -7.62 0 0)",
            "(pin passive line\n\t\t\t\t(at 1 0 0)",
            1,
        )
        if "(at 1 0 0)" not in off_body:
            die("selftest: could not move the OffGrid pin off the grid")
        off_lib = work / "Off.kicad_sym"
        if not LIB_HEADER.endswith(")\n"):
            die("selftest: library header has no closing form")
        off_lib.write_text(LIB_HEADER[:-2] + "\n" + off_body + "\n)\n", encoding="utf-8")
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            try:
                cmd_check(off_lib, "OffGrid")
            except SystemExit as exc:
                off_code = exc.code
            else:
                off_code = 0
        if off_code != 1 or "off the 2.54 mm grid" not in err.getvalue():
            die(f"selftest: off-grid check returned {off_code}: {err.getvalue()}")
        sch = work / "placed.kicad_sch"
        sch.write_text(fresh_schematic(), encoding="utf-8")
        cmd_place(lib, spec["name"], sch, "127,127")
        cmd_place(lib, spec["name"], sch, "152.4,127")
        cli_lib = work / "cli.kicad_sym"
        cli_build = subprocess.run(
            [sys.executable, __file__, "build", str(example), "--lib", str(cli_lib)],
            text=True,
            capture_output=True,
        )
        if cli_build.returncode != 0 or "Selftest_Opto" not in cli_lib.read_text(encoding="utf-8"):
            die(f"selftest: build from the command line failed:\n{cli_build.stdout}\n{cli_build.stderr}")
        clean = work / "clean.kicad_sch"
        clean.write_text(fresh_schematic(), encoding="utf-8")
        cmd_project_check(clean, None)
        sheet_err = io.StringIO()
        with contextlib.redirect_stderr(sheet_err):
            try:
                cmd_project_check(sch, None)
            except SystemExit as exc:
                sheet_code = exc.code
            else:
                sheet_code = 0
        if sheet_code != 1 or "failed to run" in sheet_err.getvalue():
            die(f"selftest: project-check on an open sheet returned {sheet_code}: {sheet_err.getvalue()}")
        placed = sch.read_text(encoding="utf-8")
        lib_ids = re.findall(r'\(lib_id "([^"]+)"', placed)
        if lib_ids.count("Sisu:Selftest_Opto") != 2:
            die(f"selftest: place instances were {lib_ids}")
        sch_tree = parse(placed)
        embedded_names = []
        for node in sch_tree.children:
            if head(node) == "lib_symbols":
                embedded_names = [symbol_name(c) for c in node.children]
        if embedded_names.count("Sisu:Selftest_Opto") != 1:
            die(f"selftest: embedded symbols were {embedded_names}")
        blocked = work / "MarineBoard"
        blocked.mkdir()
        target = blocked / "MarineBoard.kicad_sch"
        target.write_text(fresh_schematic(), encoding="utf-8")
        try:
            cmd_place(lib, spec["name"], target, "127,127")
        except SystemExit as exc:
            if exc.code != 2:
                die(f"selftest: production schematic refused with {exc.code}, want 2")
        else:
            die("selftest: production schematic was written")
        easy = work / "EasyEDA.kicad_sym"
        try:
            cmd_build(example, easy)
        except SystemExit as exc:
            if exc.code != 2:
                die(f"selftest: EasyEDA refuse returned {exc.code}")
        else:
            die("selftest: EasyEDA library was written")

        bjt_path, bjt_name = resolve_symbol("Transistor_BJT:2N3904")
        bjt_text = bjt_path.read_text(encoding="utf-8")
        bjt_tree = parse(bjt_text)
        bjt = find_symbol(bjt_tree, bjt_name)
        if bjt is None:
            die("selftest: 2N3904 missing")
        bjt_pins = [pin["number"] for pin in resolved_pins(bjt_tree, bjt)]
        if bjt_pins != ["1", "2", "3"]:
            die(f"selftest: 2N3904 pins resolved as {bjt_pins}")
        bjt_sch = work / "bjt.kicad_sch"
        bjt_sch.write_text(fresh_schematic(), encoding="utf-8")
        cmd_place(bjt_path, bjt_name, bjt_sch, "127,127")
        bjt_placed = parse(bjt_sch.read_text(encoding="utf-8"))
        embedded = []
        for node in bjt_placed.children:
            if head(node) == "lib_symbols":
                embedded = [symbol_name(c) for c in node.children if symbol_name(c)]
        if embedded != ["Transistor_BJT:Q_NPN_EBC", "Transistor_BJT:2N3904"]:
            die(f"selftest: 2N3904 cache was {embedded}")
        child_sym = None
        for node in bjt_placed.children:
            if head(node) != "lib_symbols":
                continue
            for item in node.children:
                if symbol_name(item) == "Transistor_BJT:2N3904":
                    child_sym = item
        if child_sym is None or extends_target(child_sym) != "Transistor_BJT:Q_NPN_EBC":
            die("selftest: 2N3904 cache extends the wrong parent")
        bjt_erc = work / "bjt-erc.json"
        erc = kicad(
            "sch", "erc",
            "--severity-all",
            "--format", "json",
            "-o", str(bjt_erc),
            str(bjt_sch),
        )
        if erc.returncode != 0 or not bjt_erc.is_file():
            die(f"selftest: 2N3904 schematic failed to load:\n{erc.stderr or erc.stdout}")
        bjt_bad = [
            item for item in violations(json.loads(bjt_erc.read_text(encoding="utf-8")))
            if item.get("severity") == "error" and item.get("type") not in LONE_SYMBOL_VIOLATIONS
        ]
        if bjt_bad:
            die(f"selftest: 2N3904 ERC errors {bjt_bad}")

    derived = parse(
        "(kicad_symbol_lib\n"
        "\t(symbol \"Parent\"\n"
        "\t\t(symbol \"Parent_1_1\"\n"
        "\t\t\t(pin passive line (at 0 0 0) (length 2.54) (name \"A\") (number \"1\"))\n"
        "\t\t\t(pin passive line (at 0 2.54 0) (length 2.54) (name \"B\") (number \"2\"))\n"
        "\t\t)\n"
        "\t)\n"
        "\t(symbol \"Child\"\n"
        "\t\t(extends \"Parent\")\n"
        "\t\t(symbol \"Child_1_1\"\n"
        "\t\t\t(pin passive line (at 0 0 0) (length 2.54) (name \"A2\") (number \"1\"))\n"
        "\t\t)\n"
        "\t)\n"
        ")\n"
    )
    child_pins = resolved_pins(derived, find_symbol(derived, "Child"))
    if [(pin["number"], pin["name"]) for pin in child_pins] != [("1", "A2"), ("2", "B")]:
        die(f"selftest: child pin did not replace the parent pin: {child_pins}")

    conn, conn_name = resolve_symbol("Connector_Generic:Conn_01x02")
    tree = parse(conn.read_text(encoding="utf-8"))
    pins = pins_of(find_symbol(tree, conn_name))
    if [p["number"] for p in pins] != ["1", "2"]:
        die(f"selftest: Conn_01x02 pins parsed as {pins}")
    shown = subprocess.run(
        [sys.executable, __file__, "find", "Conn_01x02", "--limit", "5"],
        text=True,
        capture_output=True,
    )
    if shown.returncode != 0 or "Connector_Generic:Conn_01x02" not in shown.stdout:
        die(f"selftest: find Conn_01x02 failed:\n{shown.stdout}\n{shown.stderr}")
    matched = subprocess.run(
        [
            sys.executable, __file__, "match",
            "Transistor_BJT:2N3904",
            "Package_TO_SOT_THT:TO-92_Inline",
        ],
        text=True,
        capture_output=True,
    )
    if matched.returncode != 0 or "pin numbers and pad numbers match" not in matched.stdout:
        die(f"selftest: 2N3904 match failed:\n{matched.stdout}\n{matched.stderr}")
    module = subprocess.run(
        [sys.executable, __file__, "find", "ESP32-S3-WROOM-2", "--footprints", "--limit", "10"],
        text=True,
        capture_output=True,
    )
    if module.returncode != 0 or "PCM_Espressif:ESP32-S3-WROOM-2" not in module.stdout:
        die(f"selftest: Espressif footprint search failed:\n{module.stdout}\n{module.stderr}")
    pads = pad_numbers(resolve_footprint("Package_TO_SOT_SMD:SOT-23"))
    if set(pads) != {"1", "2", "3"}:
        die(f"selftest: SOT-23 pads {pads}")
    print("selftest ok")


def main() -> None:
    parser = argparse.ArgumentParser(description="KiCad 10 symbol tools for the Sisu boards")
    sub = parser.add_subparsers(dest="cmd", required=True)

    find = sub.add_parser("find", help="search symbol libraries by name")
    find.add_argument("query")
    find.add_argument("--limit", type=int, default=40)
    find.add_argument("--footprints", action="store_true")

    show = sub.add_parser("show", help="print pins of Library:Name")
    show.add_argument("symbol")

    pads = sub.add_parser("pads", help="print pad numbers of Library:Name")
    pads.add_argument("footprint")

    match = sub.add_parser("match", help="compare symbol pin numbers to footprint pads")
    match.add_argument("symbol")
    match.add_argument("footprint")

    build = sub.add_parser("build", help="write a symbol from a pin-table JSON file")
    build.add_argument("pin_table", type=Path)
    build.add_argument("--lib", type=Path, default=DEFAULT_LIB)

    check = sub.add_parser("check", help="ask kicad-cli to open one symbol")
    check.add_argument("lib", type=Path)
    check.add_argument("name")

    place = sub.add_parser("place", help="put a library symbol on a schematic, with no wires")
    place.add_argument("lib", type=Path)
    place.add_argument("name")
    place.add_argument("--sch", type=Path, required=True)
    place.add_argument("--at", default="127,127")

    project = sub.add_parser("project-check", help="ERC a schematic and, with --pcb, DRC the board")
    project.add_argument("schematic", type=Path)
    project.add_argument("--pcb", type=Path)

    sub.add_parser("selftest", help="build a throwaway symbol and run it through kicad-cli")

    args = parser.parse_args()
    if args.cmd == "find":
        cmd_find(args.query, args.limit, args.footprints)
    elif args.cmd == "show":
        cmd_show(args.symbol)
    elif args.cmd == "pads":
        cmd_pads(args.footprint)
    elif args.cmd == "match":
        cmd_match(args.symbol, args.footprint)
    elif args.cmd == "build":
        cmd_build(args.pin_table, args.lib)
    elif args.cmd == "check":
        cmd_check(args.lib, args.name)
    elif args.cmd == "place":
        cmd_place(args.lib, args.name, args.sch, args.at)
    elif args.cmd == "project-check":
        cmd_project_check(args.schematic, args.pcb)
    elif args.cmd == "selftest":
        cmd_selftest()


if __name__ == "__main__":
    main()
