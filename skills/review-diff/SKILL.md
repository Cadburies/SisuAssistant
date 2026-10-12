---
name: review-diff
description: Use after verify.sh is green and before every commit or push of a non-trivial change. Gets an independent APPROVED/BLOCK verdict from a fresh reviewer agent, then handles its findings with technical rigor, without blind acceptance or performative agreement.
---

# Independent review (builder ≠ judge)

The receiving half is adapted from obra/superpowers `requesting-code-review` and `receiving-code-review` (MIT, see `../THIRD_PARTY_LICENSES.md`).

## Request

Skip review only for a pure typo or comment fix. Everything else gets one.

Start a **fresh** agent with no access to your conversation (a subagent, a second CLI session, or another AI) and give it [`reviewer.md`](reviewer.md) as its instructions. Claude Code exposes that file as the `sisu-reviewer` agent through a symlink. Give the reviewer **only**:
- the issue number (it reads the body itself),
- the exact file list,
- the diff base (`git diff HEAD -- <files>` for uncommitted, or a commit range),
- the verify.sh summary path.

Don't send your reasoning, your plan, or "I think it's fine". Fresh context is the point.

For larger logic changes (firmware lambdas, Sisu Nav API modules), also run a correctness-focused code review, if your harness has one.

## Receive

For each finding:
1. **Restate** it in your own words. If it's unclear, ask before changing anything (items may be related).
2. **Check it against the code.** Is it true for *this* repo? The reviewer can be wrong.
3. **Act:**
   - true → fix it, re-run `verify.sh`, and note "fixed: <what>"
   - false → push back with evidence (file:line, command output)
   - a design call or a conflict with a human decision → escalate on the issue
4. Order: safety and secrets → correctness → doc and cascade gaps → nits.

Don't write "you're absolutely right", "great catch" or thanks. State the fix.

## Loop

`BLOCK` → fix → verify → re-review, **at most 2 rounds**. Still blocked → comment the open findings on the issue, leave it open, and release the claim. A `BLOCK` you think is wrong goes to the human. Don't commit over it.
