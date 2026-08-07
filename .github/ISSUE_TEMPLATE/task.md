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
- [ ] `./scripts/scan_secrets.sh` green (any commit)
- [ ] Relevant `esphome config` / compose / HA live smoke green for touched stack (note skips if offline)
- [ ] Cascade complete if rename: HA → MQTT → Signal K
- [ ] No hard cutoff weaken without explicit human approval

## Notes
<!-- Depends on #N, bad pairs, human-in-the-loop / vessel access needs -->
