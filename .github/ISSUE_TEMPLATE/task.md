---
name: Agent task
about: Bug, feature, or vessel work an agent can pick up
title: ""
labels: []
---

## Task
<!-- What and why, one paragraph. Enough detail that an agent can start without asking. -->

## Touches
<!-- Directories/files this may modify. REQUIRED — parallel agents schedule around overlapping Touches. -->

## Acceptance
- [ ] Behavior as described
- [ ] `./scripts/scan_secrets.sh` green (if any secret-adjacent paths touched)
- [ ] Relevant `esphome config` / HA / compose verify green for touched stack
- [ ] No hard cutoff weaken without explicit human approval

## Notes
<!-- Cross-issue deps (Depends on #N), known bad pairs, human-in-the-loop / vessel access needs -->
