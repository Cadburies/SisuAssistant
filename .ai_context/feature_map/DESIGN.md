# Feature Map — format (approved by Frik, #139)

Small wiki-like files, one per feature, in a folder tree that **is** the feature tree. Never session-loaded — reached by grep. Goal: the fewest tokens from "I need feature X" to "I'm there and I know what to expect".

## Find a feature

```bash
grep -ril '<word>' .ai_context/feature_map --include='*.md'        # → one or a few paths
grep -r  '^tags:.*<word>' .ai_context/feature_map                  # tag-only match
ls .ai_context/feature_map/ha/helm/                                 # everything on one screen/app level
```
Then read **that one file** (~200 tokens). It is self-contained: no parent file needed.

## Layout

```
.ai_context/feature_map/
  DESIGN.md  TEMPLATE.md  TEMPLATE.sh  _lib.sh
  net/                 networks, hosts, access hops
  ha/<dashboard>/      HA vessel board + dashboards (+ package features)
  f8/<service>/        Signal K, Grafana, Influx, MQTT Explorer
  nav/<area>/          Sisu Nav (:8088) panels, layers, settings, API
  esp/<device>/        ESPHome devices (via HA Green hop)
  ext/                 Spectra, YDWG, DataHub, Victron GX, cameras, OL43
  hw/                  Marine Board hardware (docs only)
```

- **Folder path = tree = `id`.** `ha/helm/route.md` → HA › Helm › Route. Moving a feature = `git mv` + fix `id`.
- Optional `index.md` in a folder describes that level (a dashboard view, an app); same format.
- **Pair:** `<name>.md` + `<name>.sh`, same basename, same folder. `script:` names it.

## File format — see `TEMPLATE.md`, example `ha/helm/route.md`

Front matter (each on **one** line, grep-able): `title`, `id`, `kind`, `tags`, `status`, `script`.
Body: **one sentence**, then **exactly five bullets in this order**:

| Bullet | Rule |
|---|---|
| **Reach** | Full click/tap path from the app entry point + exact URL/route/IP. Never "see parent". |
| **Action** | What tap/hold/click/call does, or "display only". |
| **Needs** | Network hop, device online, Shadow ON, secrets, active route… |
| **Expect** | What you should see — including the idle / nothing-happening state, verified live. |
| **Source** | Path pointers + grep anchor. **No copies** of entity lists, card YAML, route tables, setpoints. |

Keep a file under ~20 lines. If it needs more, it is two features.

## Scripts — see `TEMPLATE.sh`, `_lib.sh`

- **Tools:** `lint.sh [folder…]` = format gate (run before every commit that touches the map) · `check.sh [folder…]` = run every script in read mode, print ok/unexpected/skip/refused table.
- **Helpers in `_lib.sh`:** `secret` · `need_tcp` · `ha_state` (HA REST) · `sk_get` (Signal K, logs in) · `nav_get` (Sisu Nav API) · `esp_get` (ESPHome web_server via HA Green hop) · `mqtt_peek` (one `sisu/v1` message via hop) · `fm_gate` · `fm_result` · `fm_open`.

- Source `_lib.sh`; `need_tcp` first (off-vessel → exit 2 SKIP); `--open` opens the page; last stdout line is one JSON `{id,result,observed}`.
- Exit: `0` expected · `1` reachable but unexpected · `2` unreachable/SKIP · `3` refused.
- `FM_MODE`: `read` (default) · `actuate` (reversible; needs `--actuate`) · `safety-critical` (alternator field/enable/shadow, relays, Spectra start/stop; needs `--actuate` **and** `FM_OPERATOR=<human>`). `fm_gate "$@"` enforces it.
- **Never** a script path that writes hard ceilings (`ALT_I_CEIL`, `ALT_T_CEIL`, `HOUSE_V_CEIL`, anything `*ceil*`/hard-limit) — `CLAUDE.md` rule 2.
- Secrets only via `secret <key>` from `homeassistant/secrets.yaml`; never echoed, never on a visible command line.
- ESP devices (Sisu-IoT) are reachable only through HA Green: use the `scripts/ha-scp.sh` + `scripts/ha-ssh.sh` + `scripts/esphome_web_client.py` pattern (call, never edit those hotspots).

## Policy

- **Tier B, search-only, never session-loaded.** Holds non-derivable "how to reach / what to expect"; everything derivable is a `Source` pointer. `INDEX.md` has one Read-Next row pointing here.
- **Self-heal:** a change that adds/removes/moves a dashboard card, Sisu Nav plugin/route, or ESPHome control updates or creates the matching file pair in the same change.
- `hw/` is documentation only; nothing under `MarineBoard/**` is ever modified by Feature Map work.
- Build-out is tracked in #140–#160 (tree + dependencies in #139).
