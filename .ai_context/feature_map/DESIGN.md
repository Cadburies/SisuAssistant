# Feature Map — design (issue #139)

> Planning output of #139. This file defines **what a node is, how the index works, and how feature scripts behave**. The map itself is built by the child issues listed in #139 — this doc is their contract.
> Not session-loaded. Agents reach it through `.ai_context/INDEX.md` → Read-Next → "Find / exercise a feature".

## 1. Purpose

One searchable tree of **every user-facing feature and actionable element** of Sisu Assistant — HA dashboards down to chips and tap actions, Sisu Nav panels and toggles, ESPHome `web_server` controls, the saloon display's touch pages, F8 services, and the hardware they run on. For any node an agent can answer:

1. **What is it / where is it** (what it looks like, URL, route, entity pointer, file).
2. **How do I get there** — follow `parent` links to the root; every hop names its preconditions and its reach script.
3. **What does its action do, what must be true first, what should I see.**
4. **Which script reaches / exercises it**, read-only by default.

Future uses the schema must keep possible: generate user manuals / brochures from node bodies; lint for consistency (dead `navigation_path`s, unknown entities, orphan Sisu Nav plugins, routes with no UI).

## 2. Research summary → root and branches

Surveyed (Sept 2026): `homeassistant/` (vessel board + 8 YAML dashboards registered in `configuration.yaml`, 16 packages, 7 python_scripts, 8 automations, empty `scripts.yaml`/`scenes.yaml`, `addons/sisu_nmea_ingest/`), `homeassistant/esphome/` (6 device entries + bench + 3 packages; `web_server` on every device), `sisu-nav/` (24 plugins under `web/src/plugins/`, 16 `/api/*` route families in `api/server.mjs`, USER_GUIDE already sectioned per feature), F8 compose (`signalk`, `influxdb`, `grafana`, `mqtt-explorer`, `sisu-nav-api`, `tileserver-gl`), `scripts/`, and `README.md` / `NETWORK.md` / `OPS.md` / `INSTALLATION.md`.

**Why this root:** every feature is only reachable after a network hop, and the hop differs by where the agent runs (Mac on Sisu LAN vs HA Green shell vs IoT VLAN). So the root is **reachability**, and the first level is **hosts / device classes**, not apps. That makes "path to root" the literal access recipe.

```
sisu                              root: "am I on the vessel network?"
├── net                           Sisu LAN 192.168.0.0/24, Sisu-IoT 192.168.10.0/24, routing/firewall allows
├── host.ha-green  (.20)          HA Green: SSH, HA REST/WS, Supervisor CLI, Mosquitto kernel
│   ├── ha.board                  vessel board (ui-lovelace.yaml)
│   ├── ha.dash.<name>            8 YAML dashboards (configuration.yaml registrations)
│   ├── ha.pkg.<name>             package features with no own dashboard (anchor watch, cameras, …)
│   └── ha.kernel                 MQTT sisu/v1 kernel, nmea ingest add-on, automations republish
├── host.f8  (.21)                TerraMaster F8: SSH :9222, Docker stack
│   ├── f8.signalk                SK server, webapps (KIP, Freeboard), plugins
│   ├── f8.grafana / f8.influx    dashboards, Flux tasks
│   └── nav                       Sisu Nav :8088 — shell, panels, layers, API routes
├── esp                           ESPHome devices on Sisu-IoT (reached via HA Green hop)
│   ├── esp.alt-port / esp.alt-stbd (.41/.42)   ⚠ safety-critical
│   ├── esp.levels (.43) · esp.freezer (.44) · esp.anchor (.46, planned)
│   └── esp.saloon-display (.45)  touch pages
├── ext                           third-party devices: Spectra (.25), YDWG, DataHub, Victron GX, SV3C cameras, OL43 (planned)
└── hw                            Marine Board hardware (MarineBoard/ KiCad/BOM) — documentation only
```

Justification for the split into child issues is in §8.

## 3. Node format

**One Markdown file per node, YAML front matter + prose body.** Markdown because the body is what a manual/brochure generator consumes; YAML front matter because agents and the linter parse it.

```markdown
---
id: ha.dash.helm.card.route-eta          # stable; never reused; see §3.2
title: Route ETA
kind: card                               # see §3.1
parent: ha.dash.helm.view.main
keywords: [eta, route, next waypoint, course, arrival]
location:
  url: http://192.168.0.20:8123/lovelace-helm/0   # or route: /api/route, or device page
  file: homeassistant/dashboards/helm.yaml          # source of truth, path pointer
  anchor: "title: Route ETA"                        # grep-able locator inside file
how_to_reach:                            # only the LAST hop; earlier hops come from ancestors
  - Open the Helm dashboard (sidebar → Helm).
  - Card sits in the second column under Instruments.
action: none                             # or: what tapping/holding/calling does
preconditions: [f8.signalk.course-api]   # node ids (resolved transitively) or short free text
expected: >
  Shows next-waypoint ETA and distance; "unknown" when no active route in Signal K.
script:
  path: scripts/feature_map/ha/helm/route_eta.sh
  mode: read                             # read | actuate | safety-critical   (§5.3)
source:                                  # pointers — never copies (§6)
  - homeassistant/packages/signalk_course.yaml
  - homeassistant/python_scripts/signalk_course.py
related: [nav.plugin.route]              # cross-links (not tree edges)
status: live                             # live | planned | unverified | broken
verified: 2026-09-26 via script (read)   # last time someone actually saw `expected`
---

What it looks like, in prose (1–6 lines). Written for a crew member, not an agent —
this is what the manual generator will lift.
```

**Required:** `id`, `title`, `kind`, `parent` (except root), `location` (at least one of url/route/file), `how_to_reach`, `expected`, `source`, `status`.
**Optional:** `keywords`, `action`, `preconditions`, `script`, `related`, `verified`, `aliases` (old ids after a rename).
**Never in front matter:** `children` (computed by the generator from `parent` — hand-maintained child lists drift), entity catalogs, card YAML, config values.

### 3.1 `kind` vocabulary

`root · network · host · service · app · dashboard · view · card · chip · control · panel · layer · setting · route · device · page · entity-group · flow · hardware`

`flow` = a multi-step procedure that spans nodes (e.g. "commission shadow mode", "start watermaker"); its body lists node ids in order. `entity-group` = a pointer to a set of entities defined in one source file (never the list itself).

### 3.2 Stable ids

- Lowercase, dot-separated segments, each segment kebab-case: `nav.plugin.weather.toggle.gusts`.
- Prefix = branch (`net`, `host`, `ha`, `f8`, `nav`, `esp`, `ext`, `hw`). The rest follows the natural UI hierarchy **at creation time**.
- **Ids are permanent.** If a feature moves in the UI, change `parent`, keep `id`. If it is genuinely renamed, create the new id and put the old one in `aliases:`; the linter resolves aliases.
- File path = `.ai_context/feature_map/nodes/<branch>/<area>/<id>.md`. File name = id, so `grep -r "id: x"` and `ls` agree.

## 4. Index, search, traverse-to-root

- **Source of truth = node files.** The index is **generated, git-ignored** (`.ai_context/feature_map/generated/`): `index.yaml` (id → file, title, kind, keywords, parent, computed children, path-to-root, transitive preconditions, script chain) and `INDEX.md` (human tree + keyword table).
  - Why not commit it: ~17 branch issues will run in parallel; a committed generated file is a guaranteed merge collision and a copy that drifts. Building takes well under a second for a few hundred files.
- **Tool:** `scripts/feature_map/fm.py` (stdlib + PyYAML — already the YAML checker named in `CLAUDE.md` §4).
  - `fm.py build` — write `generated/`.
  - `fm.py search <words>` — rank by title/keywords/aliases/body; print id, title, and **path-to-root**.
  - `fm.py path <id>` — the reach recipe: every ancestor from root down with its `how_to_reach`, `preconditions`, `expected`, and the **ordered list of scripts** to run (root first). This is the "exact path, which scripts in order, expected state at each step" requirement.
  - `fm.py lint [--branch X]` — schema, unique ids, parent exists, no cycles, `source`/`script` paths exist, `anchor` found in `file`, aliases unique, `mode` consistent with §5.3 denylist. Branch-scoped so parallel issues lint only their own subtree.
  - `fm.py check [--branch X]` — run every node's script in `read` mode, collect JSON results, report `status` drift. Offline hosts → SKIP, not FAIL.

## 5. Script conventions

### 5.1 Location and naming

- `scripts/feature_map/<branch>/<area>/<name>.{sh,py}`, one folder per child issue → disjoint Touches.
- Shared helpers: `scripts/feature_map/lib/` (owned by the Foundation issue only; later changes go through a small follow-up issue, not branch issues).
- Scripts are **new files**. They call existing tooling; they never edit `scripts/ha-*.sh`, `scripts/scan_secrets.sh`, `scripts/esphome_web_client.py` (shared hotspots).

### 5.2 Tooling per branch (reuse, don't reinvent)

| Branch | Access path | Existing tooling |
|---|---|---|
| net / hosts | ping, TCP connect | — |
| ha | HA REST `http://<ha_host>:8123/api/…` with `ha_token`; WS for dashboards config; Supervisor | `scripts/ha-cli.sh`, `scripts/ha-ssh.sh` |
| ha.kernel | MQTT `sisu/v1` on Green `:1883` | `scripts/ha-kernel-mqtt.sh` (read its env handling; subscribe via `ha-ssh.sh 'mosquitto_sub …'`) |
| f8 | Signal K REST/WS `http://<signalk_host>:<signalk_port>/signalk/v1/…`; Grafana `:3000`; SSH | `scripts/f8-ssh.sh` |
| nav | Sisu Nav `http://192.168.0.21:8088/api/*` (routes in `sisu-nav/api/server.mjs`) | — |
| esp | ESPHome `web_server` REST — **IoT VLAN only reachable from HA Green** | `scripts/esphome_web_client.py` via `scripts/ha-scp.sh` + `scripts/ha-ssh.sh` (pattern in its docstring) |
| ext | Spectra WS `.25`; cameras via HA entities | `homeassistant/python_scripts/spectra_ws.py` (read its protocol, don't import into HA) |
| hw | none — documentation only | — |

### 5.3 Safety modes

| `mode` | Meaning | Gate |
|---|---|---|
| `read` (default) | GET / subscribe / screenshot only | none |
| `actuate` | Changes state of something harmless or reversible (UI toggle, dashboard nav, Sisu Nav setting, camera mode) | `--actuate` flag required; prints what it will do; dry-run without the flag |
| `safety-critical` | Can move energy or water: alternator field/enable/shadow, relays, Spectra start/stop, anything on `esp.alt-*` | `--actuate --i-understand <node-id>`, refuses unless a human is named in `FM_OPERATOR`, re-reads `.ai_context/safety.md` preconditions, and **never** targets hard-ceiling entities |

- **Hard-ceiling denylist** (lint-enforced, in `lib/`): any entity/number/web_server name matching `ALT_I_CEIL|ALT_T_CEIL|HOUSE_V_CEIL|ceiling|hard.?limit` may appear only in `read` scripts. Changing them needs human approval per `CLAUDE.md` rule 2 — no script path exists for it.
- Scripts exit `0` = expected state seen, `1` = reachable but unexpected, `2` = unreachable/offline (SKIP), `3` = refused (gate). Last stdout line is one JSON object `{id, mode, result, observed}` for `fm.py check`.
- **Secrets:** only via `homeassistant/secrets.yaml` (read through a `lib/` loader); never echoed, never passed on a command line visible in `ps`, never written into node files. New keys follow `CLAUDE.md` rule 4 (mirror into `secrets.yaml.example`).

## 6. Reconciling with "no Tier-C mirrors"

The map is **Tier B** (cross-file synthesis: how to reach, preconditions, expected behaviour, safety class) — that part is non-derivable and is exactly what the nodes hold. Everything derivable stays in source and is referenced:

- `location.file` + `anchor` point into the YAML/TS/JS that defines the feature; `source:` lists the files. No entity lists, card configs, route tables, or setpoints are copied.
- If a generator needs derived facts (e.g. which entities a card shows), `fm.py build` extracts them **into `generated/`** at build time — regenerable, never committed.
- `expected` describes behaviour ("shows ETA, 'unknown' with no route"), not values.
- The map is **not session-loaded**; it is reached by search, so it does not cost the INDEX token budget.

**Open decision for Frik** — the map is large (estimate 300–600 nodes) and lives in `.ai_context/`. It follows the pointer rule, but its size is new for `.ai_context/`. Options: (a) keep in `.ai_context/feature_map/` as planned, with an explicit "Tier B, search-only, never session-load" exemption line in `CLAUDE.md`; (b) move nodes to `docs/feature_map/` and keep only a pointer in `.ai_context/`. The Foundation issue does (a) unless Frik says otherwise; moving later is a `git mv` plus one path constant in `fm.py`.

## 7. Staleness and maintenance

- `verified:` + `fm.py check` make staleness visible; nodes whose script fails get `status: broken` in the generated report (not auto-edited).
- **Self-heal rule for later work** (to add to `CLAUDE.md` by the Foundation issue): a change that adds/removes/moves a dashboard card, Sisu Nav plugin, API route, or ESPHome control updates the matching node in the same change — same pattern as the Sisu Nav docs self-heal.
- The consistency-lint issue adds source-side checks: dashboard `navigation_path` targets exist, entities referenced by dashboards exist in packages/ESPHome, every Sisu Nav plugin folder has a node, every `/api/*` route has a node.

## 8. Child issue split (planned in #139)

Principles: **Foundation first** (schema, tool, lib, root + top-level stubs); then **every branch issue depends only on Foundation** and owns a disjoint `nodes/<branch>/<area>/` + `scripts/feature_map/<branch>/<area>/` pair → all branch issues can run in parallel. Hotspot files are read, never modified. Consistency lint and manual POC come last.

Split granularity was chosen from the survey: HA by dashboard family (each 100–500 lines of YAML plus its packages), Sisu Nav by plugin group (USER_GUIDE sections), ESP by device role, with alternators isolated because they are safety-critical. The authoritative issue list, numbers and dependency graph live in #139 (comment + body), not here.

Hardware (`MarineBoard/`) is documented **read-only**: no child issue lists `MarineBoard/**` in Touches for modification.
