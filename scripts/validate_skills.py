#!/usr/bin/env python3
"""Validate Sisu SKILL.md files.

Adapted from agent-skills `scripts/validate-skills.js` + `scripts/lib/skill-lint.js`
(MIT, Copyright (c) 2025 Addy Osmani; see skills/THIRD_PARTY_LICENSES.md).
The section template is not enforced: Sisu skills have their own shape.

Checks (errors block):
  - SKILL.md exists, with YAML frontmatter containing `name` and `description`
  - `name` matches the directory; directory is lowercase-hyphen-separated
  - description <= 1024 chars and contains a positive "Use when/for/before..."
    trigger, not only negations
  - only Agent Skills spec keys at the top level
  - relative markdown links resolve inside the skill
  - supporting .md filenames are lowercase-hyphen-separated; no empty dirs

Warnings: SKILL.md over 500 lines.

Usage: python3 scripts/validate_skills.py [ROOT...]
Default roots: skills, MarineBoard/kicad-skills.
Exit: 0 all clear, 1 one or more errors.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

DEFAULT_ROOTS = ("skills", "MarineBoard/kicad-skills")
MAX_DESCRIPTION = 1024
MAX_LINES = 500
ALLOWED_KEYS = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}
KEBAB = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
FM = re.compile(r"^---[ \t]*\r?\n(.*?)\r?\n---[ \t]*\r?\n", re.DOTALL)
TRIGGER = re.compile(r"\buse (this )?(when|for|before|after|during|at)\b|\bapply (before|when|after)\b", re.I)
NEGATED = re.compile(r"\b(do not|don't|never) use (this )?(when|for|before|after|during|at)\b", re.I)
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")

FENCE_OPEN = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
FENCE_CLOSE = re.compile(r"^ {0,3}(`{3,}|~{3,})[ \t]*$")


def strip_fenced_blocks(text: str) -> str:
    """Blank out fenced code so links/headings inside examples are ignored."""
    out: list[str] = []
    marker = ""
    length = 0
    for line in text.splitlines():
        if marker:
            close = FENCE_CLOSE.match(line)
            if close and close.group(1)[0] == marker and len(close.group(1)) >= length:
                marker = ""
            out.append("")
            continue
        start = FENCE_OPEN.match(line)
        if start and not (start.group(1)[0] == "`" and "`" in start.group(2)):
            marker, length = start.group(1)[0], len(start.group(1))
            out.append("")
            continue
        out.append(line)
    return "\n".join(out)


def parse_frontmatter(text: str) -> tuple[dict[str, str], list[str]]:
    """Parse the top-level keys. Returns (values, YAML-shape errors)."""
    match = FM.match(text)
    if not match:
        return {}, ["missing or malformed frontmatter (expected a --- block at the top)"]
    values: dict[str, str] = {}
    errors: list[str] = []
    for line_no, line in enumerate(match.group(1).splitlines(), start=2):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        indent = line[: len(line) - len(line.lstrip())]
        if line[0] in " \t":
            if "\t" in indent:
                errors.append(f"frontmatter line {line_no}: tab indentation is invalid YAML")
            continue
        key_match = re.match(r"^([A-Za-z0-9_-]+)\s*:\s*(.*)$", line)
        if not key_match:
            errors.append(f"frontmatter line {line_no}: expected 'key: value' at column 0")
            continue
        key, value = key_match.group(1), key_match.group(2).strip()
        if key in values:
            errors.append(f"frontmatter line {line_no}: duplicate key '{key}'")
        if value and value[0] in "\"'":
            if len(value) < 2 or not value.endswith(value[0]):
                errors.append(f"frontmatter line {line_no}: quote opened by '{key}' never closes")
        elif re.search(r":(\s|$)", value):
            errors.append(f"frontmatter line {line_no}: unquoted ': ' in '{key}' — quote the value")
        elif value[:1] in "`@%*,":
            errors.append(f"frontmatter line {line_no}: '{key}' starts with YAML indicator '{value[:1]}' — quote it")
        values[key] = value[1:-1] if value[:1] in "\"'" and value[-1:] == value[:1] else value
    return values, errors


def has_trigger(description: str) -> bool:
    if not TRIGGER.search(description):
        return False
    if NEGATED.search(description):
        return bool(TRIGGER.search(NEGATED.sub("", description)))
    return True


def lint_skill(skill_dir: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        return ["missing SKILL.md"], warnings
    try:
        text = skill_md.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"unreadable SKILL.md: {exc}"], warnings

    name, fm_errors = parse_frontmatter(text)
    errors.extend(fm_errors)
    for key in name:
        if key not in ALLOWED_KEYS:
            errors.append(
                f"frontmatter key '{key}' is not an Agent Skills spec field "
                f"({', '.join(sorted(ALLOWED_KEYS))}); put vendor fields under metadata"
            )
    if not name.get("name"):
        errors.append("frontmatter missing required field: name")
    elif name["name"] != skill_dir.name:
        errors.append(f"frontmatter name '{name['name']}' does not match directory '{skill_dir.name}'")
    if not KEBAB.fullmatch(skill_dir.name):
        errors.append(f"directory '{skill_dir.name}' is not lowercase-hyphen-separated")

    description = name.get("description", "")
    if not description:
        errors.append("frontmatter missing required field: description")
    else:
        if len(description) > MAX_DESCRIPTION:
            errors.append(f"description is {len(description)} chars (limit {MAX_DESCRIPTION})")
        if not has_trigger(description):
            errors.append("description has no positive 'Use when/for/before...' trigger")

    line_count = text.count("\n")
    if line_count > MAX_LINES:
        warnings.append(f"SKILL.md is {line_count} lines (budget {MAX_LINES}) — move detail to a supporting file")

    prose = strip_fenced_blocks(text)
    for target in LINK.findall(prose):
        if re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", target) or target.startswith(("#", "/")):
            continue
        path = target.split("#", 1)[0]
        if not path or any(ch in path for ch in "<>{}"):
            continue
        if not (skill_dir / path).exists():
            errors.append(f"dead relative link: {target}")

    for dirpath, dirnames, filenames in os.walk(skill_dir):
        here = Path(dirpath)
        if not dirnames and not filenames and here != skill_dir:
            errors.append(f"empty directory: {here.relative_to(skill_dir)}/")
        for filename in filenames:
            if filename == "SKILL.md" or not filename.endswith(".md"):
                continue
            stem = filename[:-3]
            if stem.lower() == "readme":
                continue
            if not KEBAB.fullmatch(stem):
                errors.append(f"supporting file '{here.relative_to(skill_dir) / filename}' is not lowercase-hyphen-separated")
    return errors, warnings


def main(argv: list[str]) -> int:
    roots = [Path(p) for p in argv[1:]] or [Path(p) for p in DEFAULT_ROOTS]
    total_errors = total_warnings = total_skills = 0
    for root in roots:
        if not root.is_dir():
            print(f"ERROR: skills root not found: {root}", file=sys.stderr)
            total_errors += 1
            continue
        for child in sorted(root.iterdir()):
            if not child.is_dir() or not (child / "SKILL.md").exists():
                continue
            total_skills += 1
            errors, warnings = lint_skill(child)
            total_errors += len(errors)
            total_warnings += len(warnings)
            if not errors and not warnings:
                print(f"  ✓  {child}")
                continue
            print(f"  {'✗' if errors else '⚠'}  {child}")
            for message in errors:
                print(f"       ERROR: {message}")
            for message in warnings:
                print(f"       WARN:  {message}")
    status = "FAILED" if total_errors else "PASSED WITH WARNINGS" if total_warnings else "PASSED"
    print(f"\n{total_skills} skills — {total_errors} error(s), {total_warnings} warning(s) — {status}")
    return 1 if total_errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
