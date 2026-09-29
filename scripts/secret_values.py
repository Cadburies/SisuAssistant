#!/usr/bin/env python3
"""Collect the real secret values from the local, gitignored credential stores.

Used by scan_secrets.sh (index / outgoing commits) and scan_public.py (everything
GitHub publishes). Callers must only ever print the *key name*, never a value.

    python3 scripts/secret_values.py            # prints "N values from: <files>" only
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _store_root():
    """Main checkout root: gitignored secret stores only exist there, not in
    `git worktree` checkouts - so worktree commits must read them from it."""
    import subprocess
    r = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
                       cwd=ROOT, capture_output=True, text=True)
    common = r.stdout.strip()
    if r.returncode == 0 and os.path.basename(common) == ".git":
        return os.path.dirname(common)
    return ROOT


STORE_ROOT = _store_root()

YAML_STORES = ["homeassistant/secrets.yaml", "homeassistant/esphome/secrets.yaml"]
ENV_STORES = ["homeassistant/.env", "sisu-nav/.env", "sisu-nav/api/.env"]
JSON_STORES = ["homeassistant/signalk/security.json", "signalk/security.json",
               "homeassistant/.storage/application_credentials"]

SECRET_KEY = re.compile(r"pass|pwd|token|key|secret|salt|hash|credential|role", re.I)
NOT_SECRET = re.compile(r"^([0-9.:/]+|CHANGE_ME.*|true|false|null|none|\*+REMOVED\*+|\$\{.*\})$", re.I)


def _keep(key, val):
    val = (val or "").strip()
    if not SECRET_KEY.search(key) or len(val) < 8 or NOT_SECRET.match(val):
        return None
    if val.startswith(("http://", "https://", "192.168.", "/", "!secret")):
        return None
    return val


def _walk_json(obj, path, out):
    if isinstance(obj, dict):
        for k, v in obj.items():
            _walk_json(v, f"{path}.{k}" if path else k, out)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _walk_json(v, f"{path}[{i}]", out)
    elif isinstance(obj, str):
        if path in ("key", "version", "minor_version"):  # HA .storage file metadata, not secrets
            return
        leaf = path.rsplit(".", 1)[-1]
        v = _keep(leaf, obj)
        if v:
            out.append((path, v))


def load():
    """Return {value: key-label} for every secret value found, plus the files read."""
    found, files = {}, []
    for rel in YAML_STORES:
        p = os.path.join(STORE_ROOT, rel)
        if not os.path.isfile(p):
            continue
        files.append(rel)
        for m in re.finditer(r"^([A-Za-z0-9_]+):\s*[\"']?([^\"'#\n]+?)[\"']?\s*$", open(p, encoding="utf-8").read(), re.M):
            v = _keep(m.group(1), m.group(2))
            if v:
                found.setdefault(v, f"{rel}:{m.group(1)}")
    for rel in ENV_STORES:
        p = os.path.join(STORE_ROOT, rel)
        if not os.path.isfile(p):
            continue
        files.append(rel)
        for m in re.finditer(r"^\s*([A-Za-z0-9_]+)\s*=\s*[\"']?([^\"'\n]*)[\"']?\s*$", open(p, encoding="utf-8").read(), re.M):
            v = _keep(m.group(1), m.group(2))
            if v:
                found.setdefault(v, f"{rel}:{m.group(1)}")
    for rel in JSON_STORES:
        p = os.path.join(STORE_ROOT, rel)
        if not os.path.isfile(p):
            continue
        try:
            data = json.load(open(p, encoding="utf-8"))
        except (ValueError, OSError):
            continue
        files.append(rel)
        out = []
        _walk_json(data, "", out)
        for path, v in out:
            found.setdefault(v, f"{rel}:{path}")
    return found, files


def find(text, vals):
    """Key labels of every secret value present in text (str or bytes)."""
    if isinstance(text, bytes):
        text = text.decode("utf-8", "replace")
    return sorted({k for v, k in vals.items() if v in text})


def _git(*args):
    import subprocess
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True).stdout


def main(argv):
    """CLI for scan_secrets.sh / git hooks. Prints key names only; exit 1 on a hit.

      secret_values.py                 summary
      secret_values.py index           staged + tracked files (what a commit records)
      secret_values.py msg FILE        a commit message
      secret_values.py range A..B      every commit in a push: messages + full diffs
      secret_values.py text FILE|-     any text (issue body, comment) before posting
    """
    vals, files = load()
    mode = argv[1] if len(argv) > 1 else ""
    if not mode:
        print(f"{len(vals)} secret values from: {', '.join(files) or 'nothing'}")
        return 0 if vals else 1
    if not vals:
        return 0  # no local secret stores (fresh clone) - nothing to compare
    hits = []
    if mode == "index":
        skip = {"homeassistant/secrets.yaml", "homeassistant/esphome/secrets.yaml"}
        for v, k in vals.items():
            out = _git("grep", "--cached", "-l", "-F", "-e", v, "--", ".").decode().split()
            for f in out:
                if f not in skip:
                    hits.append(f"{k} -> {f}")
    elif mode == "msg":
        hits = [f"{k} -> commit message" for k in find(open(argv[2], "rb").read(), vals)]
    elif mode == "range":
        for c in _git("rev-list", *argv[2:]).decode().split():
            for k in find(_git("show", "--format=%B", "--no-color", c), vals):
                hits.append(f"{k} -> commit {c[:10]}")
    elif mode == "text":
        data = sys.stdin.buffer.read() if argv[2] == "-" else open(argv[2], "rb").read()
        hits = [f"{k} -> text" for k in find(data, vals)]
    else:
        print(main.__doc__)
        return 64
    for h in hits:
        print(f"SECRET VALUE: {h}")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
