# Sisu vessel network & infrastructure

**Version:** 1.4 · August 2026  
**Status:** Fixed vessel addressing (HA · TNAS · ESPs · lab bench)  
**Ops:** Agent access + human checklist → **`OPS.md`**  
**Interim (2026-08-09):** Mosquitto/Signal K/InfluxDB/Grafana below are documented on **F8** as their permanent home, but run on the **Mac** for now (Docker Desktop, `homeassistant/docker-compose.mac.yml`) until F8 is commissioned — details in **`OPS.md` §7** (issue #24 closed 2026-08-15 once the interim stack was stable; F8 migration checklist tracked on **#6**). Delete this line once #6 (F8 online) closes.

**Router:** **GL.iNet Flint 3 (GL-BE9300)** Wi‑Fi 7  

Covers SSIDs, HA Green, TerraMaster F8 SSD Plus, ESP32 IoT, Signal K, NMEA 2000 / SeaTalkNG, helm displays, secrets, time-series storage, and **required GL-BE9300 actions**.

Related: `Technical Specifications.md`, `MarineBoard/Technical Specs.md`, `.ai_context/naming.md`.

---

## 1. Goals

1. **All ESP32s** on **2.4 GHz Sisu-IoT** (ESP limitation).  
2. **Phones/laptops** stay on **Sisu** (Wi‑Fi 7) and open **HA** without joining Sisu-IoT — and still see live IoT.  
3. **HA Green** on **192.168.0.x** Ethernet next to **TNAS 192.168.0.21**.  
4. **ESPs** on **192.168.10.x** (Sisu-IoT).  
5. **Signal K + MQTT + Grafana** on TerraMaster F8 (Ethernet).  
6. **NMEA 2000 / SeaTalkNG** for helm (e.g. Veratron OL43), independent of Wi‑Fi.

---

## 2. Physical / logical topology

```text
                    ┌──────────────────────────────────────┐
                    │  GL.iNet GL-BE9300 (Flint 3)         │
                    │  Wi‑Fi 7 router + switch             │
                    │                                      │
                    │  SSIDs:                              │
                    │   · Sisu      → 192.168.0.0/24       │
                    │   · Sisu_Guest (isolated)            │
                    │   · Sisu-IoT  → 192.168.10.0/24      │
                    │                                      │
                    │  MUST: route .0 ↔ .10 (see §3–§4)  │
                    └───┬──────────────┬───────────────┬───┘
                        │ Ethernet     │ Ethernet      │ 2.4 GHz Sisu-IoT
                        ▼              ▼               ▼
              ┌─────────────────┐  ┌────────────────┐  ┌──────────────────┐
              │ HA Green        │  │ TerraMaster    │  │ ESP32 nodes      │
              │ 192.168.0.20    │  │ F8 SSD Plus    │  │ .41 alt port     │
              │ HA Green        │  │ 192.168.0.21   │  │ .42 alt stbd     │
              │                 │  │                │  │ .43 levels       │
              │                 │  │                │  │ .44 freezer      │
              │ HA + ESPHome    │  │ MQTT · SK      │  │ Alts · Levels    │
              │ integration     │  │ Grafana/Influx │  │ Freezer (LilyGo) │
              └────────┬────────┘  └───────┬────────┘  └────────┬─────────┘
                       │                   │                    │ N2K
                       ▼                   ▼                    ▼
              Browser on Sisu        KIP / Grafana        Raymarine · Veratron
              http://192.168.0.20    on 192.168.0.21      OL43 (helm)
```

---

## 3. SSID roles (GL-BE9300)

| SSID | Subnet | Band / clients | Internet | Role |
|------|--------|----------------|----------|------|
| **Sisu** | **192.168.0.0/24** | Wi‑Fi 7 capable phones/laptops + Ethernet LAN | Yes | Humans, HA browser, SK/Grafana UI |
| **Sisu-IoT** | **192.168.10.0/24** | **2.4 GHz** ESP32s | Yes | All IoT / ESPHome devices |
| **Sisu_Guest** | (guest) | Guests | Optional | **Fully isolated** from `.0` and `.10` |

### 3.1 “Stay on Sisu and still see IoT”

ESPs **cannot** usefully join Sisu if that SSID is Wi‑Fi 7–only for clients.  
Solution: **GL-BE9300 routes** `192.168.0.0/24` ↔ `192.168.10.0/24` with explicit firewall allows.

| From | Must reach | Why |
|------|------------|-----|
| Phone on **Sisu** (`.0`) | HA Green `:8123` | Open HA without SSID hop |
| HA Green (`.20`) | Each ESP on `.10` | ESPHome API (HA connects **to** devices) |
| HA Green | F8 `192.168.0.21:1883` | MQTT |
| Phone on **Sisu** | F8 `:3000` / Grafana | SK / trends |
| ESP on **Sisu-IoT** | DHCP, DNS, NTP; optionally HA | Connectivity / OTA via LAN |

If this is wrong: ESP shows “connected to Wi‑Fi” but HA shows **unavailable**.

### 3.2 Internet on Sisu-IoT

Allowed. Prefer DNS+NTP; OTA via HA/ESPHome on LAN. **Do not** port-forward MQTT, HA, Grafana, or ESP web to WAN.

---

## 4. GL.iNet GL-BE9300 (Flint 3) — required actions

Admin UI is typically `http://192.168.8.1` on stock firmware, or your LAN IP once re-addressed. Menu names vary slightly by TOS version; map the **intent** below.

### 4.1 Networks / SSIDs

| Action | Setting |
|--------|---------|
| Main / LAN Wi‑Fi | SSID **`Sisu`**, password per `secrets.yaml` (`sisu_wifi_*`) |
| Bands for Sisu | Enable Wi‑Fi 7 / multi-band as desired for phones/laptops |
| IoT Wi‑Fi | SSID **`Sisu-IoT`**, **2.4 GHz only** (or primary 2.4), password `wifi_*` |
| Guest | SSID **`Sisu_Guest`** — isolation **ON**, no access to LAN/IoT |
| Sisu-IoT isolation | **OFF** (or custom rules allowing HA + F8 only) |

### 4.2 IP / DHCP (match vessel plan)

| Interface | Subnet | DHCP | Notes |
|-----------|--------|------|--------|
| **LAN / Sisu** | `192.168.0.0/24` | On | Gateway typically `192.168.0.1` |
| **Sisu-IoT** | `192.168.10.0/24` | On | Separate network/VLAN, **not** the same as LAN |

**Static DHCP reservations (GL UI: Clients / Static IP / DHCP):**

| Host | IP | Network |
|------|-----|---------|
| **HA Green** | **192.168.0.20** | Sisu LAN (fixed) |
| **TerraMaster F8 (TNAS)** | **192.168.0.21** | Sisu LAN (fixed) |
| Alternator Port | **192.168.10.41** | Sisu-IoT (ESPHome + DHCP reservation) |
| Alternator Starboard | **192.168.10.42** | Sisu-IoT |
| Water Levels | **192.168.10.43** | Sisu-IoT |
| Freezer (LilyGo AMOLED) | **192.168.10.44** | Sisu-IoT |
| Anchor Tension (spare LilyGo T8/T7) | **192.168.10.46** | Reserved, not yet flashed — load cell in transit (issue #34) |
| **Lab bench T8-S3** | **192.168.10.49** | Sisu-IoT — dual-alt plant simulator (`bench_alts_sim.yaml`); not marine roles; physically connected |
| **Lab HIL test rig T8-S3** | **192.168.10.48** | Reserved, no board present — physical unit removed by the user 2026-08-10; `test_rig.yaml` kept in the repo for whenever a board occupies this IP again |

Plug HA Green and F8 into **GL-BE9300 LAN ports** (or a switch on LAN), **not** WAN.

Agent deploy / human-only router UI steps: **`OPS.md`**.

### 4.3 Firewall — must allow (Sisu boat)

Intent (what must work):

```text
# Humans on Sisu → HA UI
ACCEPT  src 192.168.0.0/24   dst 192.168.0.20   dport 8123  tcp

# HA → all ESPHome devices (API, OTA, web_server if used)  ★ most important
ACCEPT  src 192.168.0.20     dst 192.168.10.0/24

# HA → MQTT on F8
ACCEPT  src 192.168.0.20     dst 192.168.0.21   dport 1883  tcp

# Optional: phones on Sisu → SK / Grafana on F8
ACCEPT  src 192.168.0.0/24   dst 192.168.0.21   dport 3000  tcp
ACCEPT  src 192.168.0.0/24   dst 192.168.0.21   dport 3001  tcp

# Optional: IoT → HA
ACCEPT  src 192.168.10.0/24  dst 192.168.0.20

# Guest stays isolated
REJECT  src guest            dst 192.168.0.0/24, 192.168.10.0/24
```

**Forwarding between LAN and IoT must be enabled.**  
Default “IoT = internet only, no LAN” templates **break HA**.

#### Step-by-step (GL.iNet GL-BE9300 / Flint 3 admin UI)

UI labels vary slightly by firmware; use the closest match.

**A. Log in**

1. On a phone/laptop on **Sisu** (or Ethernet), open `http://192.168.0.1` (or `http://192.168.8.1` if your LAN gateway differs — check Mac: `route -n get default`).
2. Log in as router admin.

**B. Confirm two networks exist**

1. **Network** / **Wireless** / **Multi-WAN** / **IoT** (wording varies):
   - Main LAN / Wi‑Fi **Sisu** → subnet **`192.168.0.0/24`**
   - Second Wi‑Fi **Sisu-IoT** → subnet **`192.168.10.0/24`**, **2.4 GHz**
2. If Sisu-IoT does not exist yet: create a second SSID / guest-like network, assign it **`192.168.10.0/24`**, disable “client isolation” if that checkbox exists.

**C. DHCP reservations (Clients)**

1. **Clients** (or **DHCP** / **Static IP**).
2. Find **Home Assistant Green** (MAC on the box / Ethernet).
3. Reserve / bind IP **`192.168.0.20`**.
4. Later: F8 → **`.21`**; ESPs → **`.41`–`.44`**; lab T8-S3 → **`.49`**.

**D. Allow traffic LAN ↔ IoT (critical)**

Do **one** of these, depending on menu:

**Option 1 — Network isolation / IoT firewall (simplest on many GL firmware builds)**

1. Open settings for the **Sisu-IoT** network (or **Guest / IoT**).
2. Turn **OFF**:
   - “Isolate from LAN” / “Block LAN access” / “Access intranet” = disabled isolation  
   i.e. **allow** IoT devices to talk to LAN **or** allow LAN to talk to IoT.
3. Prefer: **LAN can access IoT** (HA → ESPs). Optional: IoT access LAN.
4. Keep **Guest** fully isolated if you use **Sisu_Guest**.

**Option 2 — Explicit firewall / traffic rules**

1. **Firewall** → **Traffic rules** / **Access control** / **Port forwarding** is *not* what you want — look for **Traffic rules** or **Custom rules**.
2. Add rules (Allow / Accept):

| # | Name | Source | Destination | Ports | Proto | Action |
|---|------|--------|-------------|-------|-------|--------|
| 1 | LAN to HA UI | `192.168.0.0/24` | `192.168.0.20` | 8123 | TCP | Accept |
| 2 | HA to IoT | `192.168.0.20` | `192.168.10.0/24` | all | any | Accept |
| 3 | HA to MQTT | `192.168.0.20` | `192.168.0.21` | 1883 | TCP | Accept |
| 4 | LAN to SK (opt) | `192.168.0.0/24` | `192.168.0.21` | 3000 | TCP | Accept |

3. Save / Apply. Reboot router only if it asks.

**E. What success looks like**

From Mac on **Sisu** (`192.168.0.x`):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://192.168.0.20:8123/
# After an ESP is online on IoT:
ping -c 2 192.168.10.49    # or .41 etc — may be blocked (ICMP); API still OK
# From HA SSH (agent):
./scripts/ha-ssh.sh 'ping -c 2 192.168.10.49'
```

If HA cannot ping/connect to `192.168.10.x`, rule **#2** (or isolation off) is still wrong.

**F. Do not**

- Use “IoT = internet only” templates  
- Enable AP/client isolation on Sisu-IoT  
- Port-forward 8123/1883 to the public internet
### 4.4 What NOT to do on GL-BE9300

| Avoid | Why |
|-------|-----|
| Put HA Green only on Sisu-IoT (`192.168.10.x`) | Phones on Sisu need extra hops; worse UX |
| Client isolation on Sisu-IoT | Can block HA↔ESP even with “routing” |
| Guest-style IoT (WAN only, no LAN) | ESPHome integration fails |
| Expose 8123 / 1883 / 3000 to WAN | Security risk; use VPN if remote access needed |
| Rely on mDNS across `.0` and `.10` | Often fails cross-subnet — use static IPs in HA |

### 4.5 GL-BE9300 verification checklist

After config, from a phone on **Sisu** (`192.168.0.x`):

- [ ] Open `http://192.168.0.20:8123` (HA) — loads  
- [ ] HA → Settings → Devices: ESP nodes **online** (not unavailable)  
- [ ] From HA (or a laptop on Sisu), ping `192.168.10.41` (etc.) if ICMP allowed  
- [ ] HA MQTT connected to `192.168.0.21`  
- [ ] Optional: `http://192.168.0.21:3000` Signal K from Sisu  

From an ESP on Sisu-IoT:

- [ ] IP in `192.168.10.0/24`  
- [ ] Can reach gateway / NTP  
- [ ] OTA from HA works  

### 4.6 Advanced (VLAN note)

If Sisu-IoT is implemented as a **VLAN** on Flint 3 (common), firewall **zones** must still forward **LAN → IoT** for HA and **LAN → LAN** for F8. Stock “IoT network” wizards sometimes default to **internet-only**; **change that** for Sisu. Prefer GUI zones first; SSH/UCI only if GUI cannot express the allows (see GL.iNet forum guides for GL-BE9300 IoT VLAN — adapt rules to **allow HA**, do not copy “isolate everything”).

---

## 4b. Host placement (recap)

| Host | IP | Network |
|------|-----|---------|
| **HA Green** | **192.168.0.20** | Sisu LAN Ethernet |
| **TerraMaster F8** | **192.168.0.21** | Sisu LAN Ethernet |
| Alt Port / Stbd / Levels / Freezer | **192.168.10.41 / .42 / .43 / .44** | Sisu-IoT |

**Do not** put HA on `192.168.10.x` if the goal is “phone on Sisu → HA without switching.”

---

## 4. Host roles

### 4.1 Home Assistant Green

| Item | Spec |
|------|------|
| Link | **Ethernet** to router (no onboard Wi‑Fi) |
| Runs | Home Assistant Core, ESPHome integration, automations |
| Does **not** need | Wi‑Fi secrets for itself |
| Access | `http://<ha-ip>:8123` from **Sisu** (and LAN) |

Keep Green focused on HA. Heavy marine/history services go on the F8.

### 4.2 TerraMaster F8 SSD Plus

| Item | Spec |
|------|------|
| Link | **Ethernet** (use **10 GbE** if switch supports it; 1 GbE fine for SK/MQTT) |
| CPU/RAM | Sufficient for Docker: SK + MQTT + Grafana stack + backups |
| Runs (recommended) | **Mosquitto**, **Signal K**, **Grafana + time-series DB**, optional ESPHome dashboard, git/backup shares |
| Storage | SSD array for Docker volumes, HA snapshots, long-term metrics |

**Not commissioned yet — running on the Mac in the meantime** (see interim note top of file, `OPS.md` §7). Move here and retire the Mac stack once F8 is racked/powered/on TOS.

**Signal K host network:** Ethernet on F8 — **not** “only on Sisu-IoT Wi‑Fi.”

### 4.3 ESP32 nodes

| Node | SSID | Also |
|------|------|------|
| Alternator Port / Starboard | **Sisu-IoT** | SeaTalkNG / NMEA 2000 (planned / partial) |
| Water levels | **Sisu-IoT** | — |
| Freezer (LilyGo) | **Sisu-IoT** | Local AMOLED UI |

Each may run `web_server` with **`local: true`** for bench/debug only. Primary UI = **HA on Sisu**.

---

## 5. Data paths

| Path | Flow | Notes |
|------|------|--------|
| Control / live state | ESP ↔ **HA API** | Primary; works if §3.1 routing is correct |
| Marine model | HA automations → **MQTT (F8)** → **Signal K (F8)** | KIP, SK consumers |
| Helm gauges (Veratron) | Prefer **NMEA 2000** PGNs | Not browser-on-Sisu-IoT |
| Trending | HA / SK / MQTT → **Influx or Prometheus** → **Grafana (F8)** | §8 |
| Field safety (alts) | Local ESP PID | Independent of Wi‑Fi |

---

## 6. Secrets (one boat file)

**One** `homeassistant/secrets.yaml` (ESPHome symlink). HA Green does not use Wi‑Fi secrets.

Live file: **`homeassistant/secrets.yaml`** (gitignored). Template: **`secrets.yaml.example`**.

| Key | Vessel value | Consumers |
|-----|--------------|-----------|
| `wifi_ssid` | **Sisu-IoT** | All ESPHome (`!secret wifi_ssid`) |
| `wifi_password` | (vessel IoT password) | All ESP32s |
| `sisu_wifi_ssid` / `ha_wifi_ssid` | **Sisu** | Wi‑Fi 7 phones/laptops (not ESP YAML) |
| `sisu_wifi_password` / `ha_wifi_password` | (vessel main password) | Docs / rare non-ESP clients |
| `ap_password` | ESP fallback AP | ESPHome `ap:` |
| `ota_password` | OTA | ESPHome OTA |
| `mqtt_broker` | F8 host IP/name | HA → Mosquitto on F8 |

ESP YAML uses **only** Sisu-IoT via `wifi_*`. One secrets file for HA + ESPHome (symlink).  
F8 Docker/TOS may have separate service env files for MQTT users — not Wi‑Fi passwords.

---

## 7. Helm displays (Veratron OL43 and similar)

### 7.1 Intent

Replace faded **Yanmar** RPM/engine gauges and **Kus** fuel level instruments with **high-nits waterproof** glass such as **Veratron OL43** (or same class) at the helm.

### 7.2 How these displays usually get data

| Source | Fit for OL43-class |
|--------|---------------------|
| **NMEA 2000** | **Primary** — engine RPM, temps, fuel level PGNs, etc. |
| Signal K / browser | Not a substitute for a sunlight-readable marine gauge |
| ESPHome web UI | Not for helm; debug only |
| HA dashboard on a tablet | Possible secondary, not a drop-in gauge replacement |

So helm glass is an **N2K consumer**, not an Sisu-IoT Wi‑Fi client.

### 7.3 Data sources for gauges

| Gauge need | Preferred source today | Future on Sisu stack |
|------------|------------------------|----------------------|
| Engine RPM / temps / alarms | Yanmar via **Yacht Devices** (or similar) → N2K | Marine Board CAN gateway (later) |
| Fuel level (Kus replacement) | N2K fluid level PGN from sender/gateway | Levels/fuel on Marine Board → HA → MQTT → SK **and/or** N2K PGN TX when ready |
| House / alt electrical | Victron / alts → HA/SK; optional N2K DC PGNs later | `electrical.batteries.house.*`, alternators |

### 7.4 Architecture note

```text
Yanmar / senders / gateways ──N2K──► Veratron OL43 (helm)
                              │
                              ├──► Raymarine MFD
                              └──► (optional) SK via gateway on F8 USB-CAN

Sisu Marine Board alts ──Wi‑Fi──► HA ──MQTT──► SK (F8)
                      └──N2K TX (future)──► same backbone as OL43
```

Until Marine Board transmits standard PGNs, **keep Yacht Devices (or equivalent)** for engine-critical N2K so OL43 stays reliable.

### 7.5 Practical checklist for OL43

1. Confirm **N2K LEN**, drop cables, termination, power.  
2. Map **engine instance** (port = 0, stbd = 1) to match `naming.md`.  
3. Map **fuel tank instance** to Kus replacement senders / PGN 127505.  
4. Daylight: high-nits marine glass; mount IP rating per product.  
5. Do not depend on phone-on-Sisu for primary conning gauges.

---

## 8. Time-series & trending (Docker on F8)

**Live (2026-08-10):** the HA → InfluxDB → Grafana pipeline below is wired and verified end-to-end on the interim Mac stack, not just documented as a plan. `homeassistant/packages/trending_influxdb.yaml` (HA's `influxdb:` integration) writes alternators, engines, NMEA wind/nav, Victron battery+solar, tanks and watermaker into one InfluxDB measurement per entity_id (bucket `Sisu`); `homeassistant/grafana-provisioning/` (datasource + 3 dashboards, file-provisioned so they're git-tracked) reads it back. Details + gotcha: `OPS.md` §7.

### 8.1 Goal

Long-term graphs: house voltage by location, alt current, tank levels, temps, charge stage — for drop/corrosion analysis and charge behaviour (Victron tail current). Also wind speed/angle, boat speed (SOG), and engine RPM trended together for polar-curve-style correlation (true wind/polar math needs TWS/TWA + heading, not computed yet — raw apparent-wind + SOG + RPM trend is what's live today).

### 8.2 Recommended stack (2026)

| Role | Recommendation | Why |
|------|-----------------|-----|
| **Dashboards** | **Grafana** | Best marine/ops UI, alerts, multi-source |
| **Metrics DB (HA-centric)** | **InfluxDB 2.x** (or **InfluxDB 3** if you standardize new) | First-class HA Influx integration; simple for entity history |
| **Metrics DB (ops/Prometheus style)** | **Prometheus** + **Grafana** | Pull metrics; great if you add node_exporter on F8 |
| **HA short history** | HA recorder (default/SQLite or MariaDB on F8 share) | Days–weeks; not multi-year at high res |
| **Long-term / downsample** | Influx retention + continuous queries / Prometheus recording rules | Keep SSDs healthy |

**Default Sisu choice:**

```text
HA Green  ──(Influx integration)──►  InfluxDB (Docker on F8)
MQTT / SK ──(telegraf or SK plugins)──►  InfluxDB
                                   └──►  Grafana (Docker on F8)
```

**Grafana is the right dashboard layer.** Pair it with a real TSDB; do not use Grafana alone as storage.

### 8.3 Alternatives (when to pick them)

| Stack | Use when |
|-------|----------|
| **Grafana + InfluxDB** | **Default** — HA entities, easy start |
| **Grafana + Prometheus + Loki** | You want host logs + metrics, more “SRE” style |
| **Grafana + VictoriaMetrics** | Heavier metric volume, Prometheus-compatible, efficient |
| **Grafana + TimescaleDB (Postgres)** | Strong SQL + relational joins; more ops care |
| **Home Assistant History / Statistic graphs only** | Short term only; weak for multi-year house-voltage compare |
| **Signal K chart plugins only** | Fine for underway; weaker for long electrical forensics |

### 8.4 What's actually stored (live, not examples)

Full entity list is derivable — grep `homeassistant/packages/trending_influxdb.yaml`'s `include`/`exclude` globs, or `homeassistant/grafana-provisioning/dashboards/*.json` for what's actually plotted. Summary:

| Series | Source | Use |
|--------|--------|-----|
| Alternator current/voltage/power/temp/field-duty/charge-stage, port+stbd | Marine Board (ESP) → HA | Charge behaviour, BMS tail, wiring drop |
| House voltage per engine-room sense point + delta | ESP / HA | Corrosion / drop analysis |
| Battery SoC/voltage/current/power, solar power, inverter/AC/DC loads | **Victron Color Control/Cerbo GX** direct MQTT (`packages/victron_gx.yaml`, issue #27) → HA | Solar **is** live today — see `energy_victron_stubs.yaml` for what's still a stub (cell voltages, daily yield) |
| Engine RPM/coolant/oil/boost/fuel/hours, port+stbd | Signal K REST (`signalk_engines.py`, issue #25) → HA | Helm history; needs the SK engine bridge online to populate |
| Boat speed (SOG), apparent wind speed/angle, heading, COG, depth | NMEA 0183 (YDWG/DataHub) → HA | Wind/speed/RPM correlation (polar-style); true wind not computed yet |
| Fresh water aft/fwd %, watermaker status/running/flushing/alarm | ESP + Spectra WS → HA | Tank trends, watermaker ops |

Align series names with `.ai_context/naming.md` where possible.

### 8.5 Deployment sketch (F8 Docker)

```text
F8 SSD Plus
├── mosquitto          :1883
├── signalk            :3000
├── influxdb           :8086
├── grafana            :3001  (or 3000 only if SK elsewhere)
└── volumes on SSD pool (retention policies!)
```

HA: Settings → Add-ons/integrations → **InfluxDB** → host = F8 IP.  
Phones on **Sisu**: open `http://<f8-ip>:3001` for Grafana; HA still `:8123` on Green.

---

## 9. Vessel IP plan (actual)

| Network | Subnet | Who lives here |
|---------|--------|----------------|
| **Sisu** (Wi‑Fi 7 + Ethernet LAN) | **192.168.0.0/24** | Phones, laptops, **TNAS**, **HA Green** |
| **Sisu-IoT** (2.4 GHz) | **192.168.10.0/24** | All **ESP32** nodes |

### 9.1 Where to put Home Assistant Green

**Put HA Green on Sisu LAN `192.168.0.20` (Ethernet), same side as TNAS `192.168.0.21` — not on Sisu-IoT.**

See §2–§4 for full rationale and **GL-BE9300** firewall rules.

### 9.2 Secrets (MQTT broker)

```yaml
mqtt_broker: "192.168.0.21"   # TerraMaster F8
```

ESP Wi‑Fi: `wifi_ssid: "Sisu-IoT"` only.

---

## 10. Failure modes

| Failure | Still works | Degraded |
|---------|-------------|----------|
| Sisu-IoT AP down | Local alt PID if already running; N2K helm | HA offline entities; OTA |
| HA Green down | ESP local control; N2K gauges | No setpoints UI; no MQTT republish |
| F8 down | HA + ESP live state | No SK/KIP/Grafana/MQTT history |
| Internet down | Full local boat LAN | No cloud; OTA from LAN still OK |

---

## 11. Implementation checklist

### GL-BE9300
- [ ] SSIDs: **Sisu**, **Sisu-IoT** (2.4 GHz), **Sisu_Guest** (isolated)  
- [ ] LAN `192.168.0.0/24`, IoT `192.168.10.0/24`  
- [ ] Firewall allows in §4.3 (especially **HA → 192.168.10.0/24**)  
- [ ] No Sisu-IoT client isolation that blocks HA  
- [x] DHCP reservations: HA `.20`, F8 `.21`, ESPs `.41–.44`, lab `.49` — user-confirmed durable post-reboot 2026-08-10 (#5)  
- [ ] HA Green + F8 on **LAN ports**, not WAN  

### Verification & services
- [ ] Phone on **Sisu**: HA UI loads; ESP entities online  
- [ ] HA MQTT → `192.168.0.21`  
- [ ] F8 Docker: Mosquitto + Signal K + Influx + Grafana  
- [ ] ESP secrets: `wifi_ssid: Sisu-IoT` only  
- [ ] Helm: Veratron OL43 on N2K before removing Yanmar/Kus gauges  

---

## 12. Related files

| File | Content |
|------|---------|
| `Technical Specifications.md` | System roles, firmware, safety |
| `MarineBoard/Technical Specs.md` | PCB GPIO / connectors |
| `.ai_context/naming.md` | Entity / SK / N2K names |
| `.ai_context/data_flow.md` | HA ↔ MQTT ↔ SK |
| `homeassistant/secrets.yaml` | Live secrets (not committed) |
| `homeassistant/automations.yaml` | MQTT republish |
