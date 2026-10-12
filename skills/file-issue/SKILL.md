---
name: file-issue
description: Use when new work needs a GitHub issue — a one-off non-trivial ask, a bug found mid-task, a follow-up, or a review finding you are not fixing now. Produces a template-shaped issue (Task / Touches / Acceptance / Notes) whose Touches are real paths.
---

# File an issue

Open backlog = GitHub Issues only. Never log work in markdown.

1. **Search first:** `gh issue list --state all --search "<keywords>"`. If a match exists, comment on it instead of filing a duplicate.
2. **Touches before anything else.** Use real repo paths:
   - `.ai_context/feature_map/who-uses.sh <path>` → add the feature-map `<feature>.md` + `.sh` pair if a card, plugin, route or control moves.
   - Add the cascade layers the change will need (HA package / dashboard → `automations.yaml` → `signalk-mqtt-sensors.json`) and the docs the self-heal rules will touch (README / `Technical Specifications.md` / `INSTALLATION.md`, `sisu-nav/{USER_GUIDE,DEVELOPER,INSTALLATION}.md`).
   - Over-listing beats under-listing. A missing path breaks parallel safety. An extra path only costs a little concurrency.
3. **Labels:** one type (`bug` · `enhancement` · `chore` · `documentation`), one priority (`P1`–`P3`), the domain(s). Add `needs-human` when any Acceptance box needs vessel access, hardware, or a human decision or approval. `next-issue.sh` then skips it.
4. **Notes:** `Depends on #N` (exact phrase, so `next-issue.sh`/`claim.sh` parse it), bad pairs, safety or approval needs.
5. Check the body with `python3 scripts/secret_values.py text <file>`. Issues are public. Name secrets by key only.

```bash
gh issue create --title "…" --label "bug,P2,ha" --body-file - <<'EOF'
## Task
What and why, enough to start without asking.

## Touches
- `homeassistant/packages/…`

## Acceptance
- [ ] …
- [ ] `./scripts/verify.sh` green (exit 0, or 3 with the deploy done)

## Notes
Depends on #N
EOF
```

`unslop` the title and Task paragraph.
