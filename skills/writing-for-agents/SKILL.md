---
name: writing-for-agents
description: Use when creating or editing a skill, AGENTS.md, CLAUDE.md, or any doc an agent reaches through a path pointer. Keeps the always-loaded text lean, puts the trigger in the pointer wording, and pushes branch-only detail behind a pointer.
---

# Writing for agents

Adapted from Matt Pocock's `writing-for-agents` (MIT, see `../THIRD_PARTY_LICENSES.md`).

Same levers for a skill, an `AGENTS.md` line, and a doc reached by a pointer. The agent takes the same *process* every run; it does not reproduce the same output.

## Context pointers

A **pointer** names out-of-context material and encodes when to reach it. A skill description is one; an `AGENTS.md` line naming a doc is the same object. The wording, not the target, decides whether the agent reaches it.

A pointer does two jobs: say what the material is, and list the **branches** that should trigger it. Rules:

- **Front-load the leading word** — the pointer does its triggering work there.
- **One trigger per branch.** Synonyms that rename one branch are one branch written twice.
- **Cut identity the body already carries.**
- A must-have target behind a weak pointer is a variance bug: sharpen the wording first; inline only if sharpening fails.

Sisu pointers are `AGENTS.md` paths, `.ai_context/INDEX.md` Read-Next rows, and skill descriptions. Keep them short; every always-loaded word costs every turn.

## The two loads

- **Context load** — always-loaded text: an `AGENTS.md` line, a skill description, anything in the window every turn. Spend it only on what changes behaviour.
- **Cognitive load** — what the human must remember exists. The human is the index; spend it where human judgment matters, not on things a pointer can carry.

Material behind a pointer escapes context load at the cost of the pointer's line. Material with no pointer rides entirely on the human's memory.

## Information hierarchy

Two content types: **steps** (ordered actions) and **reference** (rules and facts consulted on demand). Place each on the ladder:

1. **In-file step** — what the agent does, in order.
2. **In-file reference** — consulted on demand; a flat peer-set of rules is fine.
3. **Disclosed reference** — a sibling file or external doc behind a pointer.

**Progressive disclosure** moves detail down so the top stays legible. Branch test: inline what every branch needs; disclose what only some branches reach. **Co-location**: keep a concept's definition, rules and caveats under one heading. **Sprawl** is the failure mode: long even when every line is live; cure it with the ladder, not by trimming words.

## Steps and completion criteria

Every step ends on a **completion criterion**: how the agent knows it is done.

- **Clarity** — a vague bound ("understanding reached") invites premature completion. Sharpen the bound before hiding later steps.
- **Demand** — "every entity accounted for" forces legwork; "produce a list" does not.

The strongest criteria are checkable and exhaustive. Sisu equivalents: `verify.sh` exit 0/3, every Acceptance box ticked with evidence, every layer probed once.

## Leading words and negation

A **leading word** is a compact, pretrained concept the agent thinks with (`red` loop, `tight` loop, `tracer bullet`). Repeat the token, never the definition. Prefer a real word over a coined one: it recruits priors for free.

**Negation** is the failure beside it: "don't do X" activates X. State the positive target ("write one-line comments"). Keep a prohibition only as a hard guardrail, paired with the positive behaviour. Sisu example: prefer "fix at the source" over "don't patch the symptom" where both fit.

## Pruning

- **Single source of truth** — one authoritative place per meaning. Duplication costs maintenance and inflates prominence.
- **The environment is a source of truth** — scripts, config, `--help`, directory layout. A doc that restates a one-command lookup is a cache that goes stale. Cache only the unwritten convention, the reason, or the gotcha.
- **Relevance** — delete lines that no longer bear on the task. Without pruning, documents accumulate **sediment**: stale layers kept because removing feels risky.
- **No-ops** — if the model already does it by default, the sentence changes nothing. Delete the sentence, not just words. Test by running the document, not by debating the default.
- Keep Sisu's budget: `AGENTS.md` is a pointer-heavy contract, `.ai_context/INDEX.md` is the only always-read context file, and a skill that only restates a script should call the script instead.

## Skill-specific mechanics

- **Model-invoked** — keep the `description` with real triggers; the agent can fire it and other skills can reach it. Sisu's default.
- **User-invoked** — only the human types it. Sisu harnesses differ; keep a description anyway so discovery works, and say in the body that it is manual.
- **Router** — one skill naming the others and when to use each. Add one only when the list no longer fits in memory; `skills/README.md` already serves this role.
- After any skill edit: `python3 scripts/validate_skills.py`.

## Red flags

- A description that summarizes the workflow instead of naming the trigger
- Two rules for the same branch, or the same meaning in `AGENTS.md` and a skill
- Detail inlined for a branch only some runs take
- A doc restating `scripts/` or a config the agent can read
- A new always-loaded line with no failure it prevents

## Verification

- [ ] Each pointer says what it points to and the branches that should fire it
- [ ] Each meaning has one home; no duplicated rule
- [ ] Branch-only detail is disclosed, not inlined
- [ ] The positive target is stated; prohibitions are hard guardrails only
- [ ] `python3 scripts/validate_skills.py` passes after a skill edit
