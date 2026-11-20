---
name: correct
description: Use when the same agent mistake happens twice, the operator repeats a correction, or a review/verify failure exposes a whole class of errors. Encode the fix at the highest level that works — one owner in architecture, then a type/schema, then a gate whose error names the fix, then a test, then docs — and prove the gate fails on the real past mistake.
---

# Correct the repo, not the sentence

Adapted from pstack `correct` (MIT, see `../THIRD_PARTY_LICENSES.md`).

Assume the next contributor is an agent: it sees only the files it opened, copies the nearest example, and takes the shortest path that passes the gate. Design the repo so the wrong shortcut fails.

## When to Use

- The human corrects the same thing twice
- A review or verify failure is a class, not a one-off (wrong entity name, partial-hunk commit, stale doc, skipped deploy)
- A rule in `AGENTS.md` keeps getting violated while nothing enforces it

**Not for:** a first-time typo or a one-off judgment call with no repeat.

## Find the mistake classes

Read recent commits, reverts, review comments and the corrections in this session. Group them; a class counts once it has happened twice. Name each class by the wrong action, not by the person.

## Fix at the highest level that works

1. **One owner in the architecture.** One source of truth, one supported way to do the task, internals hidden so the wrong import fails. Delete the old path an agent would copy.
2. **A type or schema that makes the bad state unwritable.** ESPHome/HA YAML validation, a `Literal`/enum in Sisu Nav, a required field, a `Touches` schema.
3. **A gate whose error names the fix.** `verify.sh` check, `scripts/validate_skills.py`, `scan_secrets.sh`, the `.githooks/commit-msg` ceiling hook, a feature-map lint. The message must say the file and the command/pattern to use instead.
4. **A test at a real seam.** Sisu has no unit suite; use the live smoke or a one-command repro. Skip a test that would only pass by testing the mock.
5. **Docs and agent rules last.** They are for judgment calls only; nothing fails when an agent skips them.

One class per commit, smallest gate that covers it.

## Prove the gate

A check nobody has seen fail is decoration.

1. Recreate the past mistake in a throwaway branch or fixture (never in `main`).
2. Run the new gate; it must fail, loudly, naming the mistake.
3. Fix it; the gate must pass.
4. Keep the proof in the issue comment: command, red output, green output.

If the gate cannot fail on the real mistake, it is at the wrong level. Move up.

## Keep the rule table

Keep a short table in `AGENTS.md` or `skills/README.md`: **rule → what enforces it**. When the human corrects you:

- Fix the mistake now.
- Add the rule if it is missing.
- If the rule already exists and nothing enforces it, that is the repeat: fix the enforcement in the same change.
- Drop a rule once its mistake can no longer happen.

## Red flags

- Another paragraph in `AGENTS.md` where a script would do
- A gate that passes on the known-bad input
- "Be careful" as the fix
- A rule with no enforcement and no owner
- Copying the upstream repo's test-heavy levels verbatim (Sisu has no suite)

## Verification

- [ ] Each class has evidence (commit, review comment, or repeat)
- [ ] The chosen level is the highest that works; the reason a higher one failed is stated
- [ ] Every new gate was run red on the past mistake, then green on the fix
- [ ] The rule table points each rule at its enforcement
- [ ] `./scripts/verify.sh <files>` green (or exit 3 deployed)
