---
name: Agent task
about: Bug, feature, or vessel work an agent can pick up
title: ""
labels: []
---

## Task
<!-- What and why, one paragraph. Enough detail that an agent can start without asking. -->

## Touches
<!-- REQUIRED. Real directories/files this will modify. Parallel agents schedule on Touches only. -->

## Acceptance
- [ ] Behavior as described
- [ ] `./scripts/verify.sh --issue N --live <files>` green (exit 0, or 3 with the printed deploy done; note skips if offline)
- [ ] Independent review APPROVED (`skills/review-diff/`)
- [ ] Cascade complete if rename: HA → MQTT → Signal K
- [ ] No hard cutoff weaken without explicit human approval

## Notes
<!-- "Depends on #N" (exact phrase, parsed by scripts/claim.sh), bad pairs, human-in-the-loop / vessel access needs. Label `needs-human` if any box needs vessel/hardware/a human decision. Procedure: skills/file-issue/SKILL.md -->
