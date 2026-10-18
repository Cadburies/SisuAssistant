#!/usr/bin/env python3
"""Cyber-attack sweep for the whole repo (#205). Procedure: skills/cyber-check/SKILL.md.

Mechanical checks only. They find candidates; an agent then judges each one
(the skill). Nothing here prints a secret value: secret checks report key
names and file:line only.

    ./scripts/cyber-check.sh            full sweep (dependency audits, git history, GitHub)
    ./scripts/cyber-check.sh --quick    offline subset, about a minute
    ./scripts/cyber-check.sh --stale [DAYS]   exit 1 if the last full sweep is older than DAYS (7)

The report goes to ~/.sisu-cyber-check/ (outside the repo, never committed or
published). Exit: 0 nothing HIGH/MED · 1 a HIGH finding · 2 MED only · 3 a check could not run.
"""
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.expanduser("~/.sisu-cyber-check")
STAMP = os.path.join(OUT, "last-full-run")
OWNER = "Cadburies"

# Vendored or generated trees: audited as dependencies, not line by line.
SKIP = (
    "MarineBoard/Lib/", "homeassistant/esphome/.esphome/", "node_modules/",
    "MarineBoard/Documentation/", "MarineBoard/PCBWay/",
)
TEXT_EXT = (
    ".py", ".sh", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".yaml", ".yml",
    ".md", ".html", ".css", ".toml", ".txt", ".conf", ".cfg", ".ini", ".service", "Dockerfile",
)

findings = []   # (severity, area, where, what)
unrun = []


def add(sev, area, where, what):
    findings.append((sev, area, where, what))


def run(cmd, cwd=ROOT, timeout=600):
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except (OSError, subprocess.TimeoutExpired) as e:
        return 127, "", str(e)


def tracked():
    _, out, _ = run(["git", "ls-files"])
    return [f for f in out.splitlines() if not f.startswith(SKIP)]


def read(path):
    try:
        with open(os.path.join(ROOT, path), encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return ""


def is_text(path):
    return path.endswith(TEXT_EXT) or os.path.basename(path) in ("Dockerfile",) or "/.githooks/" in "/" + path


# 1. Secrets and guard rails ---------------------------------------------------
def check_secrets(quick):
    rc, out, err = run(["./scripts/scan_secrets.sh"])
    if rc != 0:
        add("HIGH", "secrets", "scripts/scan_secrets.sh", "secret scan failed:\n" + (out + err)[-1500:])
    rc, out, _ = run(["git", "config", "core.hooksPath"])
    if out.strip() != ".githooks":
        add("HIGH", "guards", "git config", "core.hooksPath is not .githooks: commit/push secret guards are off")
    for hook in ("pre-commit", "commit-msg", "pre-push"):
        p = os.path.join(ROOT, ".githooks", hook)
        if not os.access(p, os.X_OK):
            add("HIGH", "guards", ".githooks/" + hook, "hook missing or not executable")
    settings = read(".claude/settings.json")
    if "claude_hook_no_secrets.py" not in settings:
        add("HIGH", "guards", ".claude/settings.json", "PreToolUse secret hook is not wired")
    if quick:
        return
    if shutil.which("gitleaks"):
        rc, out, err = run(["gitleaks", "git", "--redact", "--no-banner", "--exit-code", "1",
                            "--report-format", "json", "--report-path", "/dev/stdout", "."], timeout=900)
        if rc == 1:
            try:
                hits = json.loads(out or "[]")
            except ValueError:
                unrun.append("gitleaks: findings reported but output was not JSON")
                hits = []
            for h in hits[:50]:
                add("HIGH", "secrets", "%s:%s @%s" % (h.get("File"), h.get("StartLine"), (h.get("Commit") or "")[:8]),
                    "gitleaks rule %s (value redacted). Real secret → rotate it, then purge" % h.get("RuleID"))
        elif rc not in (0, 1):
            unrun.append("gitleaks: " + (err or out)[-300:])
    else:
        unrun.append("gitleaks not installed (brew install gitleaks): git-history secret scan skipped")
    rc, out, err = run(["python3", "scripts/scan_public.py"], timeout=1800)
    if rc == 1:
        add("HIGH", "secrets", "GitHub (public)", "scan_public.py found a real secret value in published data (key names only):\n" + out)
    elif rc != 0:
        unrun.append("scan_public.py: " + (err or out)[-300:])


# 2. Dependencies ---------------------------------------------------------------
def check_deps(quick, files):
    locks = sorted({os.path.dirname(f) for f in files if f.endswith("package-lock.json")})
    for d in locks:
        if quick:
            continue
        rc, out, err = run(["npm", "audit", "--json", "--omit=dev"], cwd=os.path.join(ROOT, d), timeout=300)
        try:
            meta = json.loads(out).get("metadata", {}).get("vulnerabilities", {})
        except ValueError:
            unrun.append("npm audit %s: %s" % (d, (err or out)[-200:]))
            continue
        crit, high, mod = meta.get("critical", 0), meta.get("high", 0), meta.get("moderate", 0)
        if crit or high:
            add("HIGH", "deps", d + "/package-lock.json", "npm audit: %d critical, %d high (%d moderate). Run `npm audit` there" % (crit, high, mod))
        elif mod:
            add("MED", "deps", d + "/package-lock.json", "npm audit: %d moderate" % mod)
    for f in files:
        if f.endswith("package.json") and os.path.dirname(f) not in locks:
            add("MED", "deps", f, "no package-lock.json: installs are not reproducible and cannot be audited")
        if f.endswith("package.json"):
            try:
                pkg = json.loads(read(f))
            except ValueError:
                continue
            for k, v in (pkg.get("scripts") or {}).items():
                if k in ("preinstall", "install", "postinstall", "prepare"):
                    add("MED", "deps", f, "lifecycle script `%s` runs on install: %s" % (k, v))
            for sect in ("dependencies", "devDependencies"):
                for name, ver in (pkg.get(sect) or {}).items():
                    if re.match(r"^(git|github:|http|file:|link:)|/", str(ver)) and not str(ver).startswith("npm:"):
                        add("MED", "deps", f, "%s `%s` comes from %s, not the registry" % (sect, name, ver))
                    if ver in ("*", "latest", ""):
                        add("MED", "deps", f, "%s `%s` is unpinned (%s)" % (sect, name, ver or "empty"))
        if os.path.basename(f).startswith("requirements") and f.endswith(".txt"):
            for i, line in enumerate(read(f).splitlines(), 1):
                s = line.split("#")[0].strip()
                if s and not s.startswith("-") and "==" not in s:
                    add("MED", "deps", "%s:%d" % (f, i), "unpinned Python dependency `%s`" % s)
                if "--extra-index-url" in s or "--index-url" in s:
                    add("HIGH", "deps", "%s:%d" % (f, i), "custom package index (dependency confusion risk)")
    if not quick:
        if shutil.which("pip-audit"):
            for f in files:
                if os.path.basename(f).startswith("requirements") and f.endswith(".txt"):
                    rc, out, err = run(["pip-audit", "-r", f, "--progress-spinner", "off"], timeout=300)
                    if rc == 1:
                        add("HIGH", "deps", f, "pip-audit: known vulnerabilities:\n" + out[-1200:])
        else:
            unrun.append("pip-audit not installed (pipx install pip-audit): Python CVE audit skipped")


# 3. Containers ------------------------------------------------------------------
def check_containers(files):
    for f in files:
        base = os.path.basename(f)
        text = read(f)
        if base == "Dockerfile" or base.startswith("Dockerfile"):
            for i, line in enumerate(text.splitlines(), 1):
                m = re.match(r"\s*FROM\s+(\S+)", line, re.I)
                if m:
                    img = m.group(1)
                    if "@sha256:" not in img:
                        sev = "MED" if (":" not in img.split("/")[-1] or img.endswith(":latest")) else "LOW"
                        add(sev, "containers", "%s:%d" % (f, i), "base image `%s` not pinned by digest" % img)
                if re.search(r"(curl|wget)[^|]*\|\s*(ba)?sh", line):
                    add("HIGH", "containers", "%s:%d" % (f, i), "pipes a download into a shell")
        if re.match(r"docker-compose.*\.ya?ml$", base) or base == "compose.yml":
            for i, line in enumerate(text.splitlines(), 1):
                s = line.strip()
                if re.match(r"image:\s*\S+", s):
                    img = s.split(":", 1)[1].strip().strip("\"'")
                    if "@sha256:" not in img and (img.endswith(":latest") or ":" not in img.split("/")[-1]):
                        add("MED", "containers", "%s:%d" % (f, i), "image `%s` floats (latest / no tag)" % img)
                if re.match(r"privileged:\s*true", s):
                    add("HIGH", "containers", "%s:%d" % (f, i), "privileged container")
                if "docker.sock" in s:
                    add("HIGH", "containers", "%s:%d" % (f, i), "Docker socket mounted: container controls the host")
                if re.match(r"network_mode:\s*[\"']?host", s):
                    add("LOW", "containers", "%s:%d" % (f, i), "host networking: every port it opens is on the LAN")
                if re.match(r"-\s*[\"']?\d+:\d+", s):
                    add("LOW", "containers", "%s:%d" % (f, i), "port published on all interfaces (`%s`); bind to an IP if LAN-only" % s)
                if re.match(r"cap_add:", s):
                    add("MED", "containers", "%s:%d" % (f, i), "extra Linux capabilities")


# 4. GitHub Actions ----------------------------------------------------------------
def check_actions(files):
    for f in files:
        if not f.startswith(".github/workflows/"):
            continue
        text = read(f)
        if not re.search(r"^permissions:", text, re.M):
            add("MED", "ci", f, "no top-level `permissions:` (token gets the repo default)")
        if "pull_request_target" in text:
            add("HIGH", "ci", f, "`pull_request_target` runs fork code with secrets")
        for i, line in enumerate(text.splitlines(), 1):
            m = re.search(r"uses:\s*([^\s#]+)", line)
            if m and not m.group(1).startswith("./"):
                ref = m.group(1).split("@")[-1] if "@" in m.group(1) else ""
                if not re.fullmatch(r"[0-9a-f]{40}", ref):
                    add("MED", "ci", "%s:%d" % (f, i), "action `%s` pinned to a movable tag, not a commit SHA" % m.group(1))
            if re.search(r"\$\{\{\s*github\.event\.(issue|comment|pull_request|head_commit|review)", line):
                add("HIGH", "ci", "%s:%d" % (f, i), "untrusted event text interpolated into the workflow (script injection)")


# 5. ESPHome devices -----------------------------------------------------------------
def check_esphome(files):
    for f in files:
        if not re.fullmatch(r"homeassistant/esphome/[^/]+\.ya?ml", f) or f.endswith("secrets.yaml"):
            continue
        text = read(f)
        if "esphome:" not in text and "packages:" not in text:
            continue
        merged = text
        for pkg in re.findall(r"(packages/[\w.-]+\.ya?ml)", text):
            merged += "\n" + read("homeassistant/esphome/" + pkg)
        # Safety-critical: drives machinery (alternator field, watermaker pumps/valves).
        crit = re.search(r"alternator|watermaker", os.path.basename(f)) is not None or "packages/marine_alternator.yaml" in re.sub(r"#.*", "", text)
        if re.search(r"^api:", merged, re.M) and "encryption:" not in merged:
            add("HIGH" if crit else "MED", "esphome", f,
                "native API without `encryption:` — anyone on the IoT LAN can read and command this device")
        if re.search(r"^web_server:", merged, re.M) and not re.search(r"^\s+auth:", merged, re.M):
            add("HIGH" if crit else "MED", "esphome", f,
                "web_server with no `auth:` — any LAN client can press its switches/numbers")
        if re.search(r"^ota:", merged, re.M) and not re.search(r"^ota:\s*\n(?:[ \t-].*\n)*?[ \t-]+password:", merged, re.M):
            add("HIGH", "esphome", f, "OTA without a password — anyone on the LAN can flash firmware")
        if re.search(r"^\s*ap:", merged, re.M) and not re.search(r"ap:\s*\n(\s+.*\n)*?\s+password:", merged):
            add("MED", "esphome", f, "fallback AP without a password")
        for src in re.findall(r"(github://\S+|https?://\S+\.git\S*)", merged):
            if not re.search(r"@[0-9a-f]{7,40}\b", src):
                add("MED", "esphome", f, "external component `%s` not pinned to a commit" % src)


# 6. Code patterns (candidates for a human/agent to judge) --------------------------
PATTERNS = [
    ("HIGH", r"(curl|wget)\b[^|\n]*\|\s*(sudo\s+)?(ba|z)?sh\b", "download piped into a shell"),
    ("HIGH", r"StrictHostKeyChecking=no|UserKnownHostsFile=/dev/null", "SSH host keys not verified (MITM)"),
    ("HIGH", r"\bpickle\.loads?\(|\bmarshal\.loads?\(", "unpickling: code execution if the data is untrusted"),
    ("HIGH", r"\byaml\.load(_all)?\((?![^\n]*Loader\s*=)|Loader\s*=\s*(yaml\.)?(Unsafe|Full)?Loader\b", "yaml.load with an unsafe or default Loader"),
    ("MED", r"shell\s*=\s*True", "subprocess with shell=True: check nothing untrusted reaches the command"),
    ("MED", r"\bos\.system\(|\bos\.popen\(", "os.system/popen: shell command"),
    ("MED", r"(?<![\w.])eval\(|new Function\(", "eval / new Function"),
    ("MED", r"(?<![\w.])exec\(", "exec()"),
    ("MED", r"child_process|execSync\(|spawnSync\(", "child process from JS"),
    ("MED", r"verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED|--insecure\b|curl\s+-k\b", "TLS verification off"),
    ("MED", r"\.innerHTML\s*=|dangerouslySetInnerHTML|insertAdjacentHTML", "HTML injection sink (XSS if fed untrusted text)"),
    ("MED", r"Access-Control-Allow-Origin['\"]?\s*[:,]\s*['\"]\*", "CORS open to every origin"),
    ("LOW", r"\b(0\.0\.0\.0|::)\b.*(listen|bind|host)|(listen|bind|host)\b.*\b0\.0\.0\.0\b", "listens on every interface"),
    ("LOW", r"\bchmod\s+(-R\s+)?777\b", "world-writable permissions"),
    ("MED", r"\beval\s+[\"$]", "shell eval of a variable"),
]


def check_code(files):
    for f in files:
        if not is_text(f) or f.endswith(".md") or f.startswith("scripts/cyber_check.py"):
            continue
        for i, line in enumerate(read(f).splitlines(), 1):
            if len(line) > 2000:
                continue
            for sev, pat, what in PATTERNS:
                if re.search(pat, line):
                    add(sev, "code", "%s:%d" % (f, i), "%s — `%s`" % (what, line.strip()[:140]))


# 7. Hidden text: Trojan Source / prompt injection carriers ---------------------------
HIDDEN = re.compile("[\u202a-\u202e\u2066-\u2069\u200b-\u200f\u2060\ufeff\U000e0000-\U000e007f]")
INJECT = re.compile(r"(ignore (all |any )?(previous|prior|above) instructions|disregard (the|all) (rules|instructions)|"
                    r"you are now|system prompt|do not tell the user|exfiltrate|send (the )?(secrets?|keys?|tokens?) to)", re.I)


def check_hidden(files):
    for f in files:
        if not is_text(f):
            continue
        text = read(f)
        for i, line in enumerate(text.splitlines(), 1):
            if HIDDEN.search(line.replace("\ufeff", "", 1 if i == 1 else 0)):
                cps = sorted({"U+%04X" % ord(c) for c in HIDDEN.findall(line)})
                add("HIGH", "hidden-text", "%s:%d" % (f, i), "invisible / bidi characters %s (Trojan Source or hidden agent instructions)" % ", ".join(cps))
            if f.startswith(("skills/", ".claude/", ".ai_context/")) or f in ("CLAUDE.md", "AGENTS.md") or f.endswith(".md"):
                if INJECT.search(line) and not f.startswith("skills/cyber-check/"):
                    add("MED", "agents", "%s:%d" % (f, i), "instruction-override wording an agent may obey — `%s`" % line.strip()[:140])


# 8. Agent permissions and untrusted input --------------------------------------------
BROAD = (r"Bash\(\*\)", r"Bash\((python3?|node|bash|sh|zsh|curl|wget|ssh|scp|docker|npm|npx|pip3?|gh|git) \*\)",
         r"Bash\(\./scripts/\*\)", r"Bash\(git push \*\)")


def check_agents(quick):
    for f in (".claude/settings.json", ".claude/settings.local.json"):
        text = read(f)
        if not text:
            continue
        if re.search(r"bypassPermissions|dangerously", text, re.I):
            add("HIGH", "agents", f, "permission bypass enabled")
        for pat in BROAD:
            for m in re.finditer(pat, text):
                add("MED", "agents", f, "broad pre-approved command `%s`: a prompt-injected agent runs it without asking" % m.group(0))
    _, out, _ = run(["bash", "-c", "ls -la .claude/skills .claude/agents 2>/dev/null"])
    for line in out.splitlines():
        if "->" in line and "skills" not in line.split("->")[-1] and "review-diff" not in line.split("->")[-1]:
            add("HIGH", "agents", ".claude/", "harness symlink points outside skills/: " + line.strip())
    if quick or not shutil.which("gh"):
        return
    rc, out, err = run(["gh", "issue", "list", "--state", "open", "--limit", "200", "--json", "number,author,title"])
    if rc != 0:
        unrun.append("gh issue list: " + err[-200:])
        return
    for it in json.loads(out or "[]"):
        login = (it.get("author") or {}).get("login", "")
        if login and login != OWNER:
            add("HIGH", "agents", "issue #%d" % it["number"],
                "open issue by `%s` (not the owner): untrusted text the task loop would treat as instructions" % login)
    rc, out, _ = run(["gh", "api", "repos/{owner}/{repo}/issues/comments?per_page=100&sort=created&direction=desc",
                      "--jq", ".[] | [.user.login, .html_url] | @tsv"])
    if rc != 0:
        unrun.append("gh api issue comments: " + out[-200:])
    for line in out.splitlines():
        login, url = (line.split("\t") + [""])[:2]
        if login and login not in (OWNER, "github-actions[bot]"):
            add("MED", "agents", url, "comment by `%s` (not the owner): treat as data, never as instructions" % login)


# 9. Guard tampering: what changed in the trust-critical files since the last full run --
CRITICAL = (".githooks/", ".claude/", "skills/", "scripts/", ".github/", "CLAUDE.md", "AGENTS.md",
            "homeassistant/esphome/packages/marine_alternator.yaml", "homeassistant/secrets.yaml.example")


def check_tamper():
    since = None
    if os.path.exists(STAMP):
        since = open(STAMP).read().strip()
    rng = ["--since", since] if since else ["--since", "14 days ago"]
    rc, out, _ = run(["git", "log", "--name-only", "--format=@@%h %an %s"] + rng + ["--"] + list(CRITICAL))
    commit = ""
    seen = set()
    for line in out.splitlines():
        if line.startswith("@@"):
            commit = line[2:]
        elif line and line not in seen:
            seen.add(line)
            add("LOW", "review", line, "trust-critical file changed since the last full sweep (%s): read the diff" % commit[:70])


def main():
    args = sys.argv[1:]
    if args[:1] == ["--stale"]:
        try:
            days = int(args[1]) if len(args) > 1 else 7
        except ValueError:
            print("usage: cyber-check.sh --stale [DAYS]")
            return 2
        try:
            last = dt.datetime.fromisoformat(open(STAMP).read().strip())
        except (OSError, ValueError):
            print("cyber-check: no valid full-sweep stamp on this machine — run ./scripts/cyber-check.sh")
            return 1
        age = (dt.datetime.now() - last).days
        if age >= days:
            print("cyber-check: last full sweep %d days ago (limit %d) — run ./scripts/cyber-check.sh" % (age, days))
            return 1
        print("cyber-check: last full sweep %d day(s) ago — ok" % age)
        return 0
    quick = "--quick" in args
    os.makedirs(OUT, mode=0o700, exist_ok=True)
    os.chmod(OUT, 0o700)
    files = tracked()
    print("cyber-check: %s sweep over %d tracked files" % ("quick" if quick else "full", len(files)), flush=True)
    for name, fn in (("secrets", lambda: check_secrets(quick)), ("deps", lambda: check_deps(quick, files)),
                     ("containers", lambda: check_containers(files)), ("ci", lambda: check_actions(files)),
                     ("esphome", lambda: check_esphome(files)), ("code", lambda: check_code(files)),
                     ("hidden", lambda: check_hidden(files)), ("agents", lambda: check_agents(quick)),
                     ("tamper", check_tamper)):
        print("  · " + name, flush=True)
        try:
            fn()
        except Exception as e:  # a broken check must not hide the others
            unrun.append("%s: %r" % (name, e))

    order = {"HIGH": 0, "MED": 1, "LOW": 2}
    findings.sort(key=lambda x: (order[x[0]], x[1], x[2]))
    now = dt.datetime.now()
    _, head, _ = run(["git", "rev-parse", "--short", "HEAD"])
    path = os.path.join(OUT, "report-%s%s.md" % (now.strftime("%Y%m%d-%H%M"), "-quick" if quick else ""))
    count = {s: sum(1 for x in findings if x[0] == s) for s in order}
    with open(path, "w") as fh:
        fh.write("# cyber-check %s — %s @ %s\n\n" % ("quick" if quick else "full", now.isoformat(timespec="minutes"), head.strip()))
        fh.write("HIGH %d · MED %d · LOW %d · not run %d\n\n" % (count["HIGH"], count["MED"], count["LOW"], len(unrun)))
        fh.write("PRIVATE: do not paste into issues, commits, comments or chat logs that are published. "
                 "Report per skills/cyber-check/SKILL.md §Reporting.\n\n")
        for sev, area, where, what in findings:
            fh.write("- **%s** [%s] `%s` — %s\n" % (sev, area, where, what))
        if unrun:
            fh.write("\n## Not run\n\n" + "".join("- %s\n" % u for u in unrun))
    os.chmod(path, 0o600)
    # A full sweep counts for --stale even when an optional tool was missing;
    # the report lists what did not run, and the exit code (3) says so.
    if not quick:
        with open(STAMP, "w") as fh:
            fh.write(now.isoformat(timespec="seconds"))
    print("HIGH %d · MED %d · LOW %d · not run %d" % (count["HIGH"], count["MED"], count["LOW"], len(unrun)))
    for sev, area, where, what in findings:
        if sev == "HIGH":
            print("HIGH  [%s] %s — %s" % (area, where, what.splitlines()[0][:160]))
    for u in unrun:
        print("NOT RUN  " + u.splitlines()[0][:160])
    print("report: " + path)
    if count["HIGH"]:
        return 1
    if count["MED"]:
        return 2
    return 3 if unrun else 0


if __name__ == "__main__":
    sys.exit(main())
