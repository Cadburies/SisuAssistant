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
| TNAS F8 Docker (MQTT/SK) | Partial (compose) | Power + TOS login |
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
| MQTT / Signal K | TNAS F8 | Later |

**T8-S3 is not a Marine Board substitute** for production. Lab uses:

| Firmware | Role |
|----------|------|
| `bench_alts_sim.yaml` | **Dual Port + Starboard alternator simulator** (setpoints, ceilings, stages, alarms) @ `192.168.10.49` |
| `bench_t8s3.yaml` | Minimal connectivity-only test |

**Production-looking UI (no “sim” branding on dashboards):**

| Piece | Role |
|-------|------|
| `esphome/bench_alts_sim.yaml` | T8-S3 physics (hidden as “lab device”) |
| `packages/sim_production_aliases.yaml` | Maps sim → **production entity_ids** (`alternatorport_*` / `alternatorstarboard_*`) |
| `dashboards/alternators.yaml` | Real vessel **Dashboard** (same IDs after Marine Boards) |

When real boards arrive: remove/disable `sim_production_aliases.yaml`, flash `alternatorport` / `alternatorstarboard`, keep the same dashboard.

### Flash dual-alt sim (USB on Mac)

```bash
cd homeassistant/esphome
esphome run bench_alts_sim.yaml --device /dev/cu.usbmodem101
# HA → adopt bench-alts-sim (lab device)
# Dashboard: Settings → Dashboards → paste dashboards/alternators.yaml
```

Reserve MAC `30:30:F9:2D:78:EC` → `192.168.10.49` on GL-BE9300.---

## 6. Agent workflow after human §4 done

1. Deploy: `./scripts/ha-deploy-config.sh`
2. Restart Core if needed (UI or `ha core restart`)
3. Ensure ESPHome app running
4. Validate: `esphome config homeassistant/esphome/bench_t8s3.yaml`
5. Flash/adopt bench T8-S3
6. When Marine Boards exist: flash `alternatorport` / `alternatorstarboard` / `waterlevels` (never weaken hard ceilings)
7. When F8 up: MQTT integration → `192.168.0.21:1883`; automations already publish SK topics

---

## 7. Mosquitto / Signal K / Grafana / InfluxDB — temporary home on Green

**Production plan unchanged:** these belong on **F8** (see #6). **Interim exception (2026-08-09):** run them on Green now so dashboard/screen design and SK/MQTT wiring can be tested before F8 hardware is fully online. Migrate to F8 and remove from Green once #6 closes — do not let "temporary" become permanent without revisiting this section.

**Mechanism reality check (live-probed, not the compose file):** HA Green is HAOS — `docker` works via the Supervisor's Docker socket (Protection mode off, see §4.2), but there is **no `docker compose` / `docker-compose` binary** on the host, and installing one on an immutable HAOS host is unsupported. `homeassistant/docker-compose.yml` describes an F8-style bare-Docker host layout and does **not** apply to Green as-is. On Green, install these the HAOS-native way — as Supervisor **Apps** (add-ons), via `ha addons` / `ha-cli.sh` from a community add-on repository — not `docker compose up`.

**Resource budget (live-probed):** Green = 4 cores, 3.8 GiB RAM total, ~1.3 GiB free / 2.9 GiB available, 14 GiB disk free of 27.8 GiB, already running HA Core + Supervisor + ESPHome + SSH add-ons. Grafana + InfluxDB are the heavy pair — watch `free -h` / `df -h` after each add-on starts; pull an add-on back off Green rather than let the box swap.

Green = HA + ESPHome (+ SSH) **normally**; this section is the tracked exception. Sample compose remains in `homeassistant/docker-compose.yml` for F8/legacy paths.

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
