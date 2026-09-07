# Sisu operations — agent-first HA Green setup

**Audience:** human operator + coding agent (Grok) on this Mac.  
**Goal:** agent does heavy lifting; human only does physical / router / one-time UI steps.

**Source of truth:** this Mac repo, always. Every config/compose/package change is made here first, verified (`§4`), then pushed to HA Green / F8 — never edited live on the box and back-filled later. This keeps the Mac clone a working backup: if Green or F8 is unreachable, the last-known-good config still exists here.

Related: `NETWORK.md`, `AGENTS.md`, **`INSTALLATION.md`** (wiring & commission), `.ai_context/INDEX.md`, `.ai_context/displays.md`.

## Display map (tablets / MFD browsers)

| Screen | Start URL |
|--------|-----------|
| Vessel home (**Sisu** board) | `http://192.168.0.20:8123/lovelace/default_view` |
| Saloon (water) | `…/lovelace-water` |
| Engine room | `…/lovelace-engine` |
| Alternators detail | `…/lovelace-alternators` |
| Power / Victron | `…/lovelace-power` |
| Helm | `…/lovelace-helm` |
| Sisu Nav (chart / AIS / windex) | `http://<mac-lan-ip>:8088` (F8: `http://192.168.0.21:8088`) |

Avoid core **Welcome Sisu** Home as tablet start URL (sidebar house Overview).

Use Fully Kiosk / wallpanel **start URL** per display. Veratron OL43 stays on **N2K**, not HA.
---

## 1. Who does what

| Work | Agent (this Mac) | Human (you) |
|------|------------------|-------------|
| Edit YAML in repo, deploy to Green | Yes | No |
| SSH to Green, read logs, fix config | Yes | No |
| Install/configure add-ons after Supervisor access | Yes (once unlocked) | One-time unlock (below) |
| Flash ESPHome via USB or OTA | Yes (Mac USB or HA ESPHome) | Plug USB / power boards |
| GL-BE9300 DHCP / firewall | No | Yes — guided checklist |
| Physical Marine Board / engines | No | When hardware ready |
| TNAS F8 Docker (SK/Grafana/Influx) | Partial (compose) | Power + TOS login |
| Create HA long-lived token | No | One UI click |

**No extra Grok “skills” or MCP servers are required** for vessel work. Local tools: SSH key, `scripts/ha-*.sh`, optional ESPHome CLI.

---

## 2. Access model (already set on this Mac)

| Channel | Value |
|---------|--------|
| HA UI | `http://192.168.0.20:8123` — user **Sisu** |
| SSH | `sisu@192.168.0.20` port **22** (Advanced SSH & Web Terminal) |
| SSH key | `~/.ssh/id_devman` → Green authorized_keys |
| Secrets | `homeassistant/secrets.yaml` (gitignored) |
| Host alias | `ssh HomeAssistant` or `./scripts/ha-ssh.sh` |

Notes:

- Add-on lowercases the SSH username (`Sisu` → **`sisu`**).
- **SFTP is disabled** on the add-on; deploy with `./scripts/ha-deploy-config.sh` (base64 + `sudo`), not plain `scp`.
- `/config` is root-owned; agent deploys use `sudo` on the Green (same password as SSH for now).
- `ha` CLI from SSH returns *unauthorized* until **Protection mode is off** (human step §4).

---

## 3. Repo helpers

```bash
# SSH (key preferred, password fallback)
./scripts/ha-ssh.sh 'ls /config'

# Deploy full vessel HA + ESPHome tree to Green
./scripts/ha-deploy-config.sh

# Deploy one file
./scripts/ha-deploy-config.sh homeassistant/automations.yaml
```

Mac SSH config host: **HomeAssistant** / **ha** → `192.168.0.20`, user `sisu`, port 22.

**This deploy step is mandatory, not optional, whenever a HAOS-side file changes** (`configuration.yaml`, `automations.yaml`, `packages/*`, `python_scripts/*`, `dashboards/*`, etc.) — a git commit only changes this repo, not what Green is actually running. Pass the exact files touched as arguments (the no-arg form only covers a small curated legacy list); follow with `./scripts/ha-cli.sh core check` before telling anyone it's done. Full rule + rationale: `CLAUDE.md` §4 "HA Green deploy" / §6 / closing checklist.

---

## 4. Human one-time checklist (do these, then agent owns the rest)

### 4.1 Persist SSH public key in the add-on UI (survives restart)

If you **Save** Configuration with `authorized_keys: []`, the Mac key is wiped and only password works until restored.

**Recommended Configuration YAML** (merge with your password):

```yaml
ssh:
  username: Sisu
  password: "CHANGE_ME"   # use ha_ssh_password from secrets.yaml — never commit real password
  authorized_keys:
    - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICXjksxgRAeouHhAsez1EYJlueE7DTEAJL4h1uExLyr1 devman_25e392cc
  sftp: false
  compatibility_mode: false
  allow_agent_forwarding: false
  allow_remote_port_forwarding: false
  allow_tcp_forwarding: false
zsh: true
share_sessions: false
packages: []
init_commands: []
```

1. **Settings → Apps → Advanced SSH & Web Terminal → Configuration**
2. Paste the block above (keep your password if different)
3. **Save** → **Restart** add-on  
4. Confirm: `ssh HomeAssistant 'echo OK'`
### 4.2 Turn off Protection mode (enables `ha` CLI + app installs from SSH)

**Not in the Configuration YAML.** It is a switch on the add-on **Info** page:

1. **Settings → Apps → Advanced SSH & Web Terminal**
2. Open the **Info** tab (top of the app page — next to Documentation / Configuration / Log)
3. Scroll to **Protection mode**
4. Turn it **off**
5. Confirm / restart if asked

If you do not see it: some builds hide it until the app is **Running**. Start the app first, then reopen Info.

From Mac after this:

```bash
# Preferred: HA CLI via supervisor container (reliable on Green)
./scripts/ha-cli.sh apps list

# Direct `ha` inside SSH session may still say unauthorized (token not in shell env).
# Use ha-cli.sh or:  sudo docker exec hassio_cli ha apps list
```

If Protection mode is off and Docker works, agent can manage apps without the in-shell `ha` token.### 4.3 Install ESPHome app (or tell agent after §4.2)

**Settings → Apps → Add-on store → ESPHome Device Builder → Install → Start**  
Enable **Start on boot**, **Show in sidebar**.

After §4.2 the agent can install/start this via `ha apps …`.

### 4.4 Long-lived access token (optional but recommended)

The People **profile** screen (name, picture, password) is **not** where tokens live.

1. **Settings → People → Users** (or click your user **Sisu**)
2. Open the **Security** tab / section (not the profile picture area)
3. Scroll to **Long-lived access tokens**
4. **Create token** → name `agent-mac` → **copy immediately** (shown once)
5. Put in `homeassistant/secrets.yaml` as `ha_token: "…"` (never commit)

If there is no Security section: open  
`http://192.168.0.20:8123/profile/security`  
while logged in as Sisu.
### 4.5 GL-BE9300 (router) — required for real ESP devices

Follow **`NETWORK.md` §3–§4**. Minimum:

| Action | Detail |
|--------|--------|
| Reserve HA | **192.168.0.20** for Green MAC |
| Reserve TNAS | **192.168.0.21** when F8 online |
| SSIDs | **Sisu** = `192.168.0.0/24`; **Sisu-IoT** = `192.168.10.0/24` (2.4 GHz) |
| Firewall | Allow **192.168.0.20 → 192.168.10.0/24** (ESPHome API) |
| Firewall | Allow **192.168.0.0/24 → .20:8123** (phones on Sisu) |
| Optional bench | Reserve **192.168.10.49** for LilyGo T8-S3 lab board |
| Production ESPs later | `.41`–`.44` as in NETWORK.md |

Without HA→IoT allow, boards can join Wi‑Fi and still show **unavailable** in HA.

---

## 5. Hardware reality (current)

| Role | Production hardware | Now |
|------|---------------------|-----|
| Alternators / levels | **Sisu Marine Board** (ESP32-S3-WROOM-2-N32R16V) | **Not ready** — configs in repo only |
| Freezer | **LilyGo S3 AMOLED** | Config only until display board available |
| Lab connectivity | **LilyGo T8-S3** | **`esphome/bench_t8s3.yaml`** — Wi‑Fi/API/OTA only |
| HA | HA Green | Online `.20` |
| MQTT kernel | HA Green `core_mosquitto` | Live `.20:1883` (`logins:`) |
| Signal K / Grafana / Influx | TNAS F8 (Mac until #6) | Mac now |

**T8-S3 is not a Marine Board substitute.** Optional `bench_t8s3.yaml` is Wi‑Fi/API/OTA only. Alternator commission is **shadow on the real Marine Board** (`INSTALLATION.md` §6.4).

---

## 6. Agent workflow after human §4 done

1. Deploy: `./scripts/ha-deploy-config.sh`
2. Restart Core if needed (UI or `ha core restart`)
3. Ensure ESPHome app running
4. When Marine Boards exist: flash `alternatorport` / `alternatorstarboard` / `waterlevels` in **shadow** first (`INSTALLATION.md` §6.4). Never weaken hard ceilings.
7. When F8 up: SK/Grafana/Influx subscribe to Green `192.168.0.20:1883`; do not move the kernel

---

## 7. Mosquitto / Signal K / Grafana / InfluxDB — running the F8 stack on this Mac for now

**Kernel MQTT + NMEA ingest live on HA Green** (issues **#51** / **#57**). `sisu/v1` is the real-time database; it has to survive the Mac sleeping. Broker is the official Supervisor add-on **`core_mosquitto`**, using its **`logins:`** block for non-HA clients (ingest, Signal K). Ingest is the **local** Supervisor app **`local_sisu_nmea_ingest`** (**Settings → Apps**; HA 2026.2+ renamed Add-ons to Apps), not a raw `docker run`. Credentials: `mqtt_username` / `mqtt_password` in `secrets.yaml`. Apply SK plugin copies with `./scripts/apply-mqtt-creds.sh` (do not commit the password). Recreate Mosquitto options + ingest add-on: `./scripts/ha-kernel-mqtt.sh`.

**Mac still runs Signal K / Grafana / Influx** until F8 (#6). The 2026-08-09 rule “Green stays HA + ESPHome only” applied to a Mosquitto **+ Signal K** experiment that was torn down for headroom; that rule is superseded for the *kernel broker and ingest only*. Do not put SK / Grafana / Influx on Green.

**Issue #24 (which tracked standing this interim stack up) is closed (2026-08-15)** — the stack itself is stable and complete; closing didn't mean "done, no more work," it meant "this section is now the living reference, not a tracking issue." **Standing convention going forward: any task that references "the F8 stack" is executed against this Mac stack (`docker-compose.mac.yml`) until #6 closes** — SK / Grafana / Influx / MQTT Explorer, same `signalk/`/`grafana-provisioning/` trees as `docker-compose.yml`, Mac-appropriate networking instead of `network_mode: host`. Kernel Mosquitto is **not** in either compose (official `core_mosquitto` on Green). Migration checklist lives on **#6**.

**Compose file:** `homeassistant/docker-compose.mac.yml` (separate from `homeassistant/docker-compose.yml`, the F8-target SK/Grafana/Influx file — kernel broker is not in either compose). Bring up: `cd homeassistant && docker compose -f docker-compose.mac.yml up -d`. `homeassistant/signalk/` is the authoritative Signal K config. `homeassistant/{grafana,influxdb,mqtt-explorer}/` are gitignored runtime dirs. The SK MQTT plugins (`signalk-mqtt-bridge`/`signalk-mqtt-sensors`) need the broker password re-injected after a fresh checkout or container rebuild — their git-tracked config is permanently credential-free (`secrets.md` §Signal K plugin-config credentials); run `./scripts/signalk-inject-mqtt-creds.sh` then restart the `signalk` service.

**Grafana/InfluxDB wiring is now provisioned, not click-through (2026-08-10):** `homeassistant/grafana-provisioning/` (datasource + 3 dashboards — Power & Charging, Engine & Navigation, Tanks & Watermaker — all file-based, git-tracked, mounted into both compose files' `grafana` service at `/etc/grafana/provisioning`) plus `homeassistant/packages/trending_influxdb.yaml` (HA's `influxdb:` integration, the actual sensor→Influx writer). `homeassistant/.env` (gitignored; template `.env.example`) holds the Influx token/org/bucket + Grafana admin creds the compose files and provisioning YAML need — **generate/refresh it with `./scripts/gen-docker-env.sh`** (reads `secrets.yaml`, the one boat secrets file; never hand-edit `.env`). After changing anything under `grafana-provisioning/` or `.env`, re-run `docker compose -f docker-compose.mac.yml up -d grafana` (and `influxdb` if Influx env changed) to pick it up — provisioning is read at container start, not hot-reloaded.

**Gotcha that cost real debugging time — HA's `influxdb:` integration defaults `measurement_attr` to `unit_of_measurement`, not `entity_id`.** Without setting it explicitly, every entity *with* a unit (A, V, W, °C, %, kn…) silently writes into a measurement literally named `"A"`/`"V"`/`"W"`/etc instead of grouping sensibly by entity — only unit-less entities (enum/text sensors, binary_sensors) ever reach `default_measurement`. No error is logged either way (filter mismatch, not an exception) — the only way to catch it is querying InfluxDB directly (`schema.measurements()`) and noticing sensors with units are missing. `trending_influxdb.yaml` sets `measurement_attr: entity_id` deliberately — one InfluxDB measurement per entity_id (e.g. `sensor.victron_solar_power`), field `value`. Keep this if this package is ever rewritten.

**HA 2026.9 removes YAML-configured InfluxDB connections (hit live 2026-08-10, same day as the above).** `trending_influxdb.yaml` no longer sets `api_version`/`host`/`port`/`ssl`/`token`/`organization`/`bucket` — on first load HA auto-imported those into a UI config entry (`Settings → Devices & services → InfluxDB`, reconfigure there, not in YAML) and now warns/errors if any connection key remains in YAML. `measurement_attr`/`max_retries`/`include`/`exclude` stay in YAML per HA's own deprecation notice. **Known loose end:** HA created a `deprecated_yaml` repair-issue registry entry during the restart *before* this fix landed; nothing in the integration's code deletes stale repair entries once the underlying condition clears, so it may still show under Settings → Repairs even though re-triggering it won't happen anymore (confirmed via `.storage/core.config_entries` — the imported entry has the right host/org/bucket/token, and `.storage/repairs.issue_registry` shows the `deprecated_yaml` entry's timestamp unchanged since before the fix, i.e. not re-created). Safe to dismiss by hand in the UI.

**Full module set, all on the Mac now:**

| Module | Container | Host port | Notes |
|--------|-----------|-----------|-------|
| Mosquitto (kernel) | **core_mosquitto** add-on on HA Green | **192.168.0.20:1883** | official add-on; `logins:` = `mqtt_username` / `mqtt_password` |
| NMEA ingest | **`local_sisu_nmea_ingest`** add-on on **HA Green** | host net | YDWG `.30:1456` + DataHub `.31:11102` → `sisu/v1` |

**Ingest ops:** **Settings → Apps** → Sisu NMEA ingest (or `./scripts/ha-kernel-mqtt.sh` after daemon / MQTT-secret changes). That script copies `nmea_wind_daemon.py` into `/addons/sisu_nmea_ingest`, sets options from secrets, rebuilds/starts the app, and removes any leftover `sisu-nmea-ingest` container. Logs: app Log tab, or `./scripts/ha-cli.sh addons logs local_sisu_nmea_ingest`. Healthy: `MQTT connected to 127.0.0.1:1883` and `connected to ydwg` / `datahub`. Dual-listen / merge / payload: `.ai_context/sources.md`.
| Signal K | `signalk-server-mac` | 3000 | Admin UI + **KIP bundled** at `/@mxtommy/kip/` — no separate KIP container exists or is needed |
| InfluxDB | `influxdb-mac` | 8086 | v2.x; one-time org/bucket/token setup via UI on first visit |
| Grafana | `grafana-mac` | 3001 | Moved off :3000 since Signal K owns it; default login `admin`/`admin`, forced change on first sign-in |
| MQTT Explorer | `mqtt-explorer-mac` | 4000 | Debug UI for the Mosquitto broker above |
| Sisu Nav | `sisu-nav-api-mac` | 8088 | Chart + AIS + windex (#76). SK login required. tileserver-gl on **8087**. |

**Live NMEA (DataHub/YDWG) bridged to Signal K on the Mac (R34).** Docker Desktop's Mac VM can't route container traffic into `192.168.10.x` — confirmed dead ends: the Mac's own OS reaches DataHub fine but no container can, even with Docker Desktop's "host networking" beta on (Settings → Resources → Network; that toggle also once destabilized port publishing for the whole stack until a full `docker compose down && up` — leave it **off**, no benefit); `macvlan` isn't supported on Docker Desktop for Mac at all.

**Working bridge:** `scripts/mac-nmea-relay.sh` — a host-side `socat` relay (auto-restarting) forwarding `192.168.10.31:11102` (DataHub) and `192.168.10.30:1456` (YDWG) onto local ports, reachable from containers via Docker's built-in `host.docker.internal`. `homeassistant/signalk/settings.json`'s two `pipedProviders` entries point at `host.docker.internal` instead of the real IPs to use it. **Live-confirmed working:** position/wind/depth/AIS flowing into Signal K within seconds of the relay starting.

- **Start:** `./scripts/mac-nmea-relay.sh &` (or let an agent launch it in the background) — not currently a launchd service, so it doesn't survive a Mac reboot/logout on its own; restart it manually (or ask an agent to) after one.
- **Mac-only, tracked, must revert before F8:** this whole bridge — the relay script *and* the two `host.docker.internal` entries in `settings.json` — only makes sense on the Mac. Before any F8 deploy, point `settings.json`'s `ydwg-nmea0183`/`datahub-nmea0183` `host` fields back to `192.168.10.30`/`192.168.10.31` and retire the relay script; F8 needs neither (real host networking, same LAN).
- YDWG (`.30`) may still show `Network is unreachable` in the relay's own log even with the bridge working — that means the device itself is off/not on the network right now, not a bridging problem; DataHub (`.31`) is what's been confirmed live.

**HA's MQTT integration points at the Green kernel broker `192.168.0.20:1883`** (#51). Live config entry (not git). F8 (#6) will subscribe to this same broker for SK/Grafana — do not move the kernel back to F8 just because F8 is the historian.

**Mac-vs-Linux networking gotcha:** Docker Desktop doesn't do Linux host networking, so Mac services publish explicit ports instead of `network_mode: host`. SK talks to the Green kernel at `mqtt://192.168.0.20:1883` with `mqtt_username` in git and the password injected live by `./scripts/apply-mqtt-creds.sh` (never commit the password).

**Reachable at:** the Mac's LAN IP (`192.168.0.151` as of 2026-08-09; check `ipconfig getifaddr en0` if it changes) on the ports above — confirmed from other LAN hosts, not just localhost. Only up while the Mac is on and Docker Desktop is running — that's the accepted tradeoff for design/test, not a production guarantee.

**Mechanism note on Green (for the record, not current state):** HA Green is HAOS — `docker` works via the Supervisor's Docker socket (Protection mode off, see §4.2), but there is **no `docker compose` binary** on the host. Supervisor **Apps** exist for Mosquitto (official)/Grafana/InfluxDB (`a0d7b954_*`); none exists for Signal K, which is why it was run via plain `docker run` in the first (now-reverted) attempt.

---

## 8. Backup

After stable config: **Settings → System → Backups → Create backup**.  
Store a copy off-box (Mac / F8 share). Reset without backup = full re-onboarding.

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| SSH connection refused | Start Advanced SSH add-on; confirm port 22 open |
| Config incomplete / add-on exits | Set `ssh.password` or `authorized_keys` in add-on config |
| `ha … unauthorized` | Protection mode **off** |
| Deploy permission denied | Scripts use sudo; check `ha_ssh_password` in secrets |
| ESP unavailable in HA | Router: HA `.20` → `192.168.10.0/24` |
| scp fails | SFTP off — use `ha-deploy-config.sh` |

---

## 10. Version

OPS.md created with HA Green reset (OS 18.1 / Core 2026.7.3), agent SSH key, bench T8-S3, deploy scripts.

---

## Spectra Newport 400c automation

| Item | Value |
|------|--------|
| Device | `192.168.0.25:9000` (WebSocket, subprotocol `dumb-increment-protocol`) |
| Bridge | `homeassistant/python_scripts/spectra_ws.py` |
| Package | `homeassistant/packages/spectra_newport.yaml` |
| Page atlas | **`homeassistant/docs/SpectraControl.md`** |
| Dashboard | `/lovelace-water` |

### Confirmed UI sequence

1. Home page **4** → soft key **START** (`BUTTON1`)
2. Page **37** SELECT RUN MODE → **AUTORUN** (not FILLTANK)
3. Page **29** AMOUNT → choose **liters** *or* **hours** radio, then amount field
4. Open amount (`LABEL0`) → page **12** keyboard → `{"page":"12","data":"<n>"}`
5. **OK** (`BUTTON3`) → page **10** “System starting” → page **32** AUTORUN dashboard
6. **STOP** on run pages is `BUTTON0` (label STOP); on home it is `BUTTON2`

**Unit choice (operator habit):**
- **Liters** — make a volume / fill tanks (default; smart uses tank shortfall or 400 L).
- **Hours** — time-box the run when dirty water is coming (river bar, silt, outgoing tide). Example: dirty water in ~3 h → autorun **3 hours** so the machine stops before sucking grit into the prefilters.

Device always freshwater-flushes after a start/stop cycle. Startup can divert into FWF; cancel flush and retry.

### Agent / CLI

```bash
# Live status
python3 homeassistant/python_scripts/spectra_ws.py status

# Full autorun (default 400 L)
python3 homeassistant/python_scripts/spectra_ws.py autorun 400

# Context-aware stop (then device FWF)
python3 homeassistant/python_scripts/spectra_ws.py stop

# Cancel flush mid-cycle
python3 homeassistant/python_scripts/spectra_ws.py cancel_flush
```

On HA Green the same script is at `/config/python_scripts/spectra_ws.py`.

### HA controls (Water dashboard)

- **Smart autorun** — tank shortfall if marine boards online, else **400 L**
- **Autorun (use amount)** — `input_number.spectra_autorun_liters`
- **Stop** — context-aware; Spectra runs FWF after
- **Auto-stop at ≥95 %** — only when tank level entities are present

Tanks: forward 400 L + aft 400 L (entity ids from ESPHome `waterlevels` when adopted).

---

## Alternator / LiFePO gauge limits

**Authoritative policy:** `homeassistant/docs/ALTERNATOR_LIMITS.md`  
(do not re-debate scale vs hard ceiling vs user setpoint — update that file).

Quick table:

| | User SP (orange) | Hard (red) | Scale max |
|---|---:|---:|---:|
| Current | 150 A default | **250 A** | **320 A** rated |
| House V | 14.3 abs / 14.1 float | **14.4 V** | **14.7 V** |
| Temp | 95 °C default | **125 °C** | **150 °C** |
| V low | — | orange ≤12.0 · red ≤11.0 | min 10.0 |

Firmware clamps at **hard**, never only at scale max.

---

## Two “Overview” entries in the sidebar

| Sidebar item | What it is | URL |
|--------------|------------|-----|
| **House icon · Overview** | Built-in HA **Home** (“Welcome Sisu”, Favorites, Repairs…) | Core home landing |
| **Grid / other · Overview** or vessel content | **YAML vessel board** (`ui-lovelace.yaml`) | `/lovelace/` or `/lovelace/default_view` |

**Use the vessel board as the boat home.**

### One-time UI (human)

1. Open the board with **Ship zones** / **Live status** (not “Welcome Sisu”).
2. Profile → **Browser settings** → **Dashboard** → set that board as default.
3. **Settings → Dashboards** → find the Welcome / Home Overview → ⋮ → **Remove from sidebar** (if offered).
4. Optional: bookmark `http://192.168.0.20:8123/lovelace/default_view` on tablets.

Tablets / kiosk start URLs should use role paths (`/lovelace-water`, `/lovelace-alternators`, …) or the vessel default_view — not the Welcome Home landing.
