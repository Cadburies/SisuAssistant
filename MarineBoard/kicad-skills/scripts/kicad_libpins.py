"""Read KiCad 10 symbols: the flattened block (extends resolved) and pin endpoints per unit.

A library nickname resolves through PROJECT_LIBS first (set by use_project), then
KiCad's bundled libraries. Used by draft_sch.py.
"""
import os
import re

LIBDIR = "/Applications/KiCad/KiCad.app/Contents/SharedSupport/symbols"
_cache = {}
PROJECT_LIBS = {}


def use_project(project_dir):
    """Load nickname -> file from <project_dir>/sym-lib-table (${KIPRJMOD} expanded)."""
    path = os.path.join(project_dir, "sym-lib-table")
    if not os.path.exists(path):
        return
    for name, uri in re.findall(r'\(name "([^"]+)"\)\(type "[^"]+"\)\(uri "([^"]+)"\)', open(path).read()):
        PROJECT_LIBS[name] = os.path.normpath(uri.replace("${KIPRJMOD}", project_dir))


def block(text, start):
    i = text.find(start)
    if i < 0:
        return None
    d = 0
    for j in range(i, len(text)):
        c = text[j]
        if c == '(':
            d += 1
        elif c == ')':
            d -= 1
            if d == 0:
                return text[i:j + 1]


def children(b):
    """Top-level child blocks of a block (skip the head)."""
    out, d, start = [], 0, None
    for j, c in enumerate(b):
        if c == '(':
            d += 1
            if d == 2:
                start = j
        elif c == ')':
            if d == 2:
                out.append(b[start:j + 1])
            d -= 1
    return out


def raw(lib, name):
    if lib not in _cache:
        _cache[lib] = open(PROJECT_LIBS.get(lib, f"{LIBDIR}/{lib}.kicad_sym")).read()
    text = _cache[lib]
    b = block(text, f'\t(symbol "{name}"\n') or block(text, f'(symbol "{name}"\n')
    if b is None:
        raise KeyError(f"{lib}:{name}")
    return b


def flat(lib, name):
    """Symbol block with `extends` resolved, renamed to lib:name for lib_symbols."""
    b = raw(lib, name)
    m = re.search(r'\(extends "([^"]+)"\)', b)
    if m:
        base = flat(lib, m.group(1))  # already renamed to lib:base
        props = [c for c in children(b) if c.startswith('(property')]
        keep = [c for c in children(base) if not c.startswith('(property')]
        base_name = m.group(1)
        keep = [c.replace(f'(symbol "{base_name}_', f'(symbol "{name}_') for c in keep]
        body = "\n".join(props + keep)
        return f'(symbol "{lib}:{name}"\n{body}\n)'
    return b.replace(f'(symbol "{name}"', f'(symbol "{lib}:{name}"', 1)


def pins(lib, name):
    """{unit: [(number, name, x, y, angle, etype)]}; unit 0 pins are added to every unit."""
    b = flat(lib, name)
    units = {}
    for sub in children(b):
        m = re.match(r'\(symbol "[^"]*_(\d+)_(\d+)"', sub)
        if not m:
            continue
        u = int(m.group(1))
        for p in re.finditer(r'\(pin (\w+) \w+\s*\(at ([\-\d.]+) ([\-\d.]+) ([\-\d.]+)\).*?\(name "([^"]*)".*?\(number "([^"]*)"', sub, re.S):
            units.setdefault(u, []).append((p.group(6), p.group(5), float(p.group(2)), float(p.group(3)), int(float(p.group(4))), p.group(1)))
    common = units.pop(0, [])
    if not units:
        units = {1: []}
    for u in units:
        units[u] = common + units[u]
    return units


if __name__ == "__main__":
    import sys
    for arg in sys.argv[1:]:
        lib, name = arg.split(":")
        for u, ps in pins(lib, name).items():
            print(arg, "unit", u, [(n, nm, x, y, a, t) for n, nm, x, y, a, t in ps])
