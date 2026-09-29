#!/usr/bin/env python3
"""Audit everything GitHub publishes for this repo for real secret values.

Checks every object a fresh mirror clone of the repo and its wiki can see
(all branches, tags, refs/pull/*), old commits still fetchable by SHA from
GitHub's cache (SHAs quoted in issues/commits), every issue / PR title, body
and comment **including edit history**, PR review comments, releases, gists,
and every GitHub Actions run log + artifact.

Values come from scripts/secret_values.py (local gitignored stores). Only key
names and locations are printed — never a value.

    python3 scripts/scan_public.py            # full audit (a few minutes)
    python3 scripts/scan_public.py --quick    # issues/comments/logs only (no clone)
Exit 0 = clean, 1 = a value was found, 2 = could not run.
"""
import functools, io, json, os, re, subprocess, sys, tempfile, zipfile

print = functools.partial(print, flush=True)

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import secret_values  # noqa: E402

ROOT = os.path.dirname(HERE)
QUICK = "--quick" in sys.argv
hits = []
FETCHED = []  # cached old commits pulled in by SHA (not on any ref)


def sh(*args, check=True, **kw):
    r = subprocess.run(args, capture_output=True, **kw)
    if check and r.returncode:
        raise RuntimeError(f"{' '.join(args[:4])}: {r.stderr.decode(errors='replace')[:300]}")
    return r.stdout


def repo_slug():
    return sh("gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner", cwd=ROOT).decode().strip()


# --- value matchers -----------------------------------------------------------
VALUES, FILES = secret_values.load()
if not VALUES:
    sys.exit("no secret values found locally - nothing to audit against")
LONG = re.compile(b"|".join(re.escape(v.encode()) for v in sorted(VALUES, key=len, reverse=True)))
LABEL = {v.encode(): k for v, k in VALUES.items()}
# Short secrets (4-7 chars) only as a whole token, to avoid noise.
SHORT = {}
for m in re.finditer(r"^([A-Za-z0-9_]+):\s*[\"']?([^\"'#\n]+?)[\"']?\s*$",
                     open(os.path.join(ROOT, "homeassistant/secrets.yaml"), encoding="utf-8").read(), re.M):
    k, v = m.group(1), m.group(2).strip()
    # Factory-default words (a device still on "admin") are not findable - they are ordinary text.
    if v.lower() in {"admin", "password", "guest", "root", "user", "12345", "123456", "1234567"}:
        continue
    if secret_values.SECRET_KEY.search(k) and 4 <= len(v) < 8 and not secret_values.NOT_SECRET.match(v):
        SHORT[v] = f"homeassistant/secrets.yaml:{k}"
SHORT_RE = [(re.compile(rb"(?<![A-Za-z0-9])" + re.escape(v.encode()) + rb"(?![A-Za-z0-9])"), k) for v, k in SHORT.items()]


def scan(data, where):
    if isinstance(data, str):
        data = data.encode(errors="replace")
    found = {LABEL[m.group(0)] for m in LONG.finditer(data)}
    found |= {k for rx, k in SHORT_RE if rx.search(data)}
    for k in sorted(found):
        hits.append((k, where))


# --- git objects ----------------------------------------------------------------
def scan_git_objects(gitdir, name):
    p = subprocess.Popen(["git", "--git-dir", gitdir, "cat-file", "--batch-all-objects", "--batch"],
                         stdout=subprocess.PIPE)
    n = 0
    while True:
        header = p.stdout.readline()
        if not header:
            break
        sha, typ, size = header.split()
        body = p.stdout.read(int(size))
        p.stdout.read(1)
        n += 1
        before = len(hits)
        scan(body, f"{name} {typ.decode()} {sha.decode()[:10]}")
        if len(hits) > before and typ == b"blob":  # say where the blob lives
            paths = sh("git", "--git-dir", gitdir, "log", "--all", *FETCHED, "--format=%h", "--name-only",
                       f"--find-object={sha.decode()}", check=False).decode().split()
            hits[-1] = (hits[-1][0], hits[-1][1] + f" ({' '.join(paths[:4])})")
    p.wait()
    return n


def mirror(url, dest):
    r = subprocess.run(["git", "clone", "--mirror", "--quiet", url, dest], capture_output=True)
    return r.returncode == 0


# --- GitHub API sources ------------------------------------------------------------
def gh_lines(path, jq):
    out = sh("gh", "api", "--paginate", path, "--jq", jq, check=False)
    return [json.loads(l) for l in out.decode().splitlines() if l.strip()]


def scan_issues(slug):
    texts = []
    for it in gh_lines(f"repos/{slug}/issues?state=all&per_page=100", ".[] | {n:.number,t:.title,b:(.body // \"\")}"):
        texts.append((f"issue #{it['n']} title/body", it["t"] + "\n" + it["b"]))
    for c in gh_lines(f"repos/{slug}/issues/comments?per_page=100", ".[] | {u:.html_url,b:(.body // \"\")}"):
        texts.append((f"comment {c['u']}", c["b"]))
    for c in gh_lines(f"repos/{slug}/pulls/comments?per_page=100", ".[] | {u:.html_url,b:(.body // \"\")}"):
        texts.append((f"PR review comment {c['u']}", c["b"]))
    # Edit history is public ("edited" dropdown) - old revisions can still hold a value.
    owner, name = slug.split("/")
    cursor = None
    q = """query($o:String!,$n:String!,$c:String){repository(owner:$o,name:$n){
      issues(first:40,after:$c){pageInfo{hasNextPage endCursor} nodes{number
        userContentEdits(first:50){nodes{diff}}
        comments(first:100){nodes{url userContentEdits(first:50){nodes{diff}}}}}}}}"""
    while True:
        args = ["gh", "api", "graphql", "-f", f"query={q}", "-f", f"o={owner}", "-f", f"n={name}"]
        if cursor:
            args += ["-f", f"c={cursor}"]
        data = json.loads(sh(*args))["data"]["repository"]["issues"]
        for iss in data["nodes"]:
            for e in iss["userContentEdits"]["nodes"]:
                texts.append((f"issue #{iss['number']} edit history", e.get("diff") or ""))
            for c in iss["comments"]["nodes"]:
                for e in c["userContentEdits"]["nodes"]:
                    texts.append((f"comment edit history {c['url']}", e.get("diff") or ""))
        if not data["pageInfo"]["hasNextPage"]:
            break
        cursor = data["pageInfo"]["endCursor"]
    for rel in gh_lines(f"repos/{slug}/releases?per_page=100", ".[] | {t:.tag_name,b:(.body // \"\")}"):
        texts.append((f"release {rel['t']}", rel["b"]))
    for where, t in texts:
        scan(t, where)
    return texts


def scan_actions(slug):
    runs = gh_lines(f"repos/{slug}/actions/runs?per_page=100", ".workflow_runs[] | {id:.id,n:.name}")
    for r in runs:
        z = sh("gh", "api", f"repos/{slug}/actions/runs/{r['id']}/logs", check=False)
        if z[:2] == b"PK":
            with zipfile.ZipFile(io.BytesIO(z)) as zf:
                for f in zf.namelist():
                    scan(zf.read(f), f"Actions run {r['id']} ({r['n']}) log {f}")
    arts = gh_lines(f"repos/{slug}/actions/artifacts?per_page=100", ".artifacts[] | {id:.id,n:.name,x:.expired}")
    for a in arts:
        if a["x"]:
            continue
        z = sh("gh", "api", f"repos/{slug}/actions/artifacts/{a['id']}/zip", check=False)
        if z[:2] == b"PK":
            with zipfile.ZipFile(io.BytesIO(z)) as zf:
                for f in zf.namelist():
                    scan(zf.read(f), f"Actions artifact {a['n']} {f}")
    return len(runs), len(arts)


def scan_gists(slug):
    owner = slug.split("/")[0]
    gists = gh_lines(f"users/{owner}/gists?per_page=100", ".[] | {id:.id}")
    for g in gists:
        data = json.loads(sh("gh", "api", f"gists/{g['id']}"))
        for name, f in data.get("files", {}).items():
            scan(f.get("content") or "", f"gist {g['id']} {name}")
    return len(gists)


def main():
    try:
        slug = repo_slug()
    except RuntimeError as e:
        print(f"cannot reach GitHub: {e}")
        return 2
    print(f"Auditing {slug} against {len(VALUES)} values (+{len(SHORT)} short) from {', '.join(FILES)}")
    texts = scan_issues(slug)
    print(f"  issues/PRs/comments/edit history/releases: {len(texts)} texts")
    runs, arts = scan_actions(slug)
    print(f"  Actions: {runs} run logs, {arts} artifacts")
    print(f"  public gists: {scan_gists(slug)}")
    if not QUICK:
        with tempfile.TemporaryDirectory() as tmp:
            repo_git = os.path.join(tmp, "repo.git")
            if not mirror(f"https://github.com/{slug}.git", repo_git):
                print("  mirror clone failed")
                return 2
            # Old commits quoted anywhere (issues, commit messages) that are gone from
            # history may still be served from GitHub's cache - fetch and scan them too.
            quoted = set()
            for _, t in texts:
                quoted |= set(re.findall(r"\b[0-9a-f]{7,40}\b", t))
            quoted |= set(re.findall(r"\b[0-9a-f]{7,40}\b",
                                     sh("git", "--git-dir", repo_git, "log", "--all", "--format=%B").decode()))
            missing = [s for s in sorted(quoted)
                       if subprocess.run(["git", "--git-dir", repo_git, "cat-file", "-e", s],
                                         capture_output=True).returncode]
            served = []
            for s in missing:
                full = sh("gh", "api", f"repos/{slug}/commits/{s}", "--jq", ".sha", check=False).decode().strip()
                if re.fullmatch(r"[0-9a-f]{40}", full):
                    served.append(full)
            fetched = []
            if served:  # one negotiation for all of them
                subprocess.run(["git", "--git-dir", repo_git, "fetch", "--quiet", "origin", *served], capture_output=True)
                fetched = [f[:10] for f in served if subprocess.run(
                    ["git", "--git-dir", repo_git, "cat-file", "-e", f], capture_output=True).returncode == 0]
            FETCHED[:] = [f for f in served if f[:10] in fetched]
            print(f"  cached old commits still served by SHA: {len(fetched)} of {len(missing)} quoted SHAs not in history"
                  + (f" ({' '.join(fetched)})" if fetched else ""))
            print(f"  repo git objects: {scan_git_objects(repo_git, 'repo')}")
            wiki_git = os.path.join(tmp, "wiki.git")
            if mirror(f"https://github.com/{slug}.wiki.git", wiki_git):
                print(f"  wiki git objects: {scan_git_objects(wiki_git, 'wiki')}")
            else:
                print("  wiki: none")
    if hits:
        print(f"\nFOUND {len(hits)} exposure(s) - key name -> where (values not shown):")
        for k, w in sorted(set(hits)):
            print(f"  {k} -> {w}")
        return 1
    print("\nscan_public: CLEAN - no secret value in anything GitHub publishes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
