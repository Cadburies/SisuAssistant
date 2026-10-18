# Sisu skills

The repo's skills, one folder each, with a `SKILL.md` (frontmatter `name` + a "Use when…" `description`). They are plain markdown plus repo scripts, so they don't depend on any one AI or harness. Any agent (Claude, Grok, Codex, …) reads the `SKILL.md` whose trigger fits the task. `AGENTS.md` and `CLAUDE.md` point here. Harness adapters are only symlinks: `.claude/skills → skills/` and `.claude/agents/sisu-reviewer.md → review-diff/reviewer.md`, so Claude Code auto-discovers the same files. A new harness gets another symlink, never a copy.

| Skill | Use when | Gates it calls |
| --- | --- | --- |
| [`do-issue`](do-issue/SKILL.md) | "do issue #N", "pick next work", any non-trivial task: the whole loop | `next-issue.sh` · `claim.sh` · `verify.sh` · `release.sh` |
| [`file-issue`](file-issue/SKILL.md) | new work, a bug found mid-task, a follow-up | `who-uses.sh` · `secret_values.py text` |
| [`debug-root-cause`](debug-root-cause/SKILL.md) | any bug, wrong reading, missing value, failed build/deploy (before fixing) | layer probes ESP → HA → MQTT → SK → Nav |
| [`verify-before-done`](verify-before-done/SKILL.md) | before any "done / fixed / deployed / passing" claim | `verify.sh` · `ha-cli.sh core check` · `stack-drift.sh` |
| [`review-diff`](review-diff/SKILL.md) | after verify, before commit/push | fresh reviewer agent with [`review-diff/reviewer.md`](review-diff/reviewer.md) |
| [`ui-evidence`](ui-evidence/SKILL.md) | a visible change (dashboard, saloon, Sisu Nav) after deploy | any browser-automation tool |
| [`unslop`](unslop/SKILL.md) | commit messages, issue text, docs, comments | — |
| [`cyber-check`](cyber-check/SKILL.md) | weekly (`--stale` at session start), before pushes touching deps / workflows / scripts / agent files / ESPHome / compose, before a production OTA, any security audit | `cyber-check.sh` · `scan_secrets.sh` · `scan_public.py` |

The order in a task: `do-issue` → (`debug-root-cause`) → implement → `verify.sh` → `review-diff` → deploy → `ui-evidence` → `verify-before-done` → `unslop` → `release.sh` → push.

## Adding a skill

- Add one only for a procedure that is repeated and that agents get wrong. One-off knowledge goes in `.ai_context/` or a path pointer.
- Put checks that can be code in `scripts/` and have the skill call them. A skill that only restates a script will drift from it.
- Copying from elsewhere needs a license that allows it (MIT/Apache). Add a row and the notice to [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md), and adapt the skill to this repo's gates instead of pasting it.
- Keep skills harness-neutral: name the capability ("a fresh agent session", "a browser-automation tool"), not one product's tool names.
- Considered and not adopted (Oct 2026): superpowers TDD / git-worktrees / finishing-a-branch / subagent-driven-development, which assume a test suite or a PR flow (this repo has neither: verify gates, direct-to-main); greploop, which needs Greptile; `new-feature`, a worktree-per-task flow.
