---
name: deprecation
description: Use when removing or renaming an HA entity, MQTT topic, ESPHome package or device, dashboard card, Sisu Nav route/panel, or a documented hardware role — and when retiring a prototype or old implementation. Keeps the HA → MQTT → Signal K cascade atomic, proves nothing still consumes the old name, and leaves the as-built record intact.
---

# Deprecate and migrate (Sisu)

Adapted from agent-skills `deprecation-and-migration` (MIT, see `../THIRD_PARTY_LICENSES.md`).

## Overview

Every retained name is a contract: an entity in a dashboard, a topic in an automation, a Signal K path in Grafana, a file in an install doc. Removing one is a migration, not a delete. Prove the consumers are gone first, or the failure shows up as an unavailable entity or a silent flatline later.

## When to Use

- Renaming or removing an HA entity, MQTT topic, Signal K path, or dashboard card
- Replacing an ESPHome device, package, or hardware role (prototype → Marine Board)
- Removing a Sisu Nav route, plugin, or API field
- Deleting a doc that is the only as-built record of a board
- Deciding whether to keep a legacy path or finish the migration

**Not for:** adding a new name. That is `do-issue` + the normal cascade.

## The contract

`AGENTS.md` Mandatory rule 3 is the cascade: **ESPHome → HA → `automations.yaml` → `signalk-mqtt-sensors.json` → dashboards → Influx/Grafana → Sisu Nav**, all in the same change. Rule 11 allows **one public name per quantity** — no permanent `_live`/`_slow` twins.

So the default is **atomic**, not expand/contract. Expand/contract is only for a consumer this repo does not control (a guest integration, an external Grafana dashboard, a third-party script) and is time-boxed:

1. **Expand** — add the new name and keep the old one publishing only for the external consumer. The old name is marked deprecated in the issue and gets a removal date.
2. **Migrate** — point every in-repo consumer at the new name; verify on the live path.
3. **Contract** — delete the old name once the external consumer confirms the switch. Never leave the alias as a second public name.

## Procedure

1. **Inventory consumers before touching anything.**
   ```bash
   .ai_context/feature_map/who-uses.sh <path>
   rg -n '<entity|topic|sk-path|route>' homeassistant sisu-nav MarineBoard
   ```
   Also check the HA states API, MQTT subscribers, and the Signal K delta stream if the name is live. A doc hit is a consumer too.
2. **Write the change as one cascade.** Same commit: producer, HA entity, automation, SK mapping, dashboard, feature-map pair, docs. Use `verify.sh --live` to confirm entities still resolve.
3. **Retire the producer last.** Remove the ESPHome entity/package only after the HA → SK consumers no longer reference it. A rename that leaves the old producer running is a twin.
4. **Delete the leftovers in the same change:** old mapping rows, dashboard references, docs, `risks.md` rows, feature-map entries. No commented-out block as a "backup" — git is the backup.
5. **Hardware/prototype retirement:** move the retired file under `archive/` (never flash it), keep the as-built record in `MarineBoard/Documentation/` or the board's version doc, update `README.md`/`Technical Specs.md`/`INSTALLATION.md`, and say what replaced it and why.
6. **State the migration in the issue comment** — old name → new name → consumers checked — so the next agent does not re-add the old one.

## Red flags

- Deleting a name before `who-uses.sh`/`rg` shows zero consumers
- A deprecated alias with no removal date
- "Keep both, it's safer" — that is a permanent twin (rule 11)
- Deleting the only doc that records how a board was built
- Renaming HA only, leaving the MQTT topic or SK path stale
- Removing a dashboard card but leaving the entity in `configuration.yaml`

## Verification

- [ ] `rg` finds no live reference to the old name outside `archive/`
- [ ] `./scripts/verify.sh --live --issue N <files>` green (or exit 3 deployed)
- [ ] The new path is observed end to end: entity state, MQTT message, SK path
- [ ] Feature-map pair, README/spec/install docs updated in the same change
- [ ] The issue comment names the old/new value and the consumers checked
