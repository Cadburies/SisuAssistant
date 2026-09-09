# Secrets & security pointers

Pointers only. **Never** paste live passwords into context docs, commits, or issue comments.

## One boat secrets file

| Path | Used by |
|------|---------|
| `homeassistant/secrets.yaml` | Home Assistant + ESPHome (`esphome/secrets.yaml` symlink) — **gitignored**. Sisu Nav Charts/Bathymetry can write harvest keys here (#102) |
| `homeassistant/secrets.yaml.example` | Template committed to git (`CHANGE_ME` only) |

**Sync rule (mandatory, enforced):** any key added, removed, or renamed in `secrets.yaml` must be mirrored into `secrets.yaml.example` in the **same change** — same key, placeholder value, one-line comment saying what it's for and where to get/generate it, **never** a real value. `./scripts/scan_secrets.sh` fails the commit if the two files' key sets don't match (skipped gracefully if `secrets.yaml` doesn't exist locally). This is what lets someone clone the repo and stand up the same setup without asking what any variable means — see `secrets.yaml.example`'s own comments for the "where do I get this" answer per key.

HA Green has **no Wi‑Fi** — no router SSID secrets needed for the Green itself.  
TerraMaster F8 holds **Docker/service** env (Mosquitto users, SK admin) separately under TOS — not duplicated into ESP secrets.

## Live keys (structure only)

Authoritative file: `homeassistant/secrets.yaml` (never committed).  
Template: `homeassistant/secrets.yaml.example`.

| Key | Role | Used by |
|-----|------|---------|
| `wifi_ssid` / `wifi_password` | **Sisu-IoT** | All ESP32 |
| `sisu_wifi_*` / `ha_wifi_*` | **Sisu** main Wi‑Fi | Docs / rare non-ESP clients |
| `ap_password` | ESP fallback AP | ESPHome `ap:` |
| `ota_password` | Shared OTA | Most ESPHome devices |
| `api_encryption_key` | Shared HA API encryption | Bench / marine packages as wired |
| `freezer_ota_password` / `freezer_api_encryption_key` | Device-specific LilyGo freezer | `esphome/freezer.yaml` |
| `mqtt_broker` / `mqtt_username` / `mqtt_password` | F8 broker | HA MQTT |
| `ha_host` / `ha_host_username` / `ha_host_pwd` | HA UI owner | Browser / REST |
| `ha_ssh_*` | SSH add-on | `scripts/ha-*.sh` |
| `ha_token` | Optional long-lived token | Agent API |
| `esp_ip_*` | Inventory static IPs | Docs / YAML `manual_ip` |
| `YDWG_URL` / `YDWG_USERNAME` / `YDWG_PASSWORD` | YDWG-02 web admin (IoT) | UI only; NMEA TCP unauthenticated |
| `ydwg_nmea_port` | Default **1456** | `nmea_gateways.py` / SK |
| `PREDICTWIND_HUB_LOCAL_URL` / `PREDICTWIND_HUB_*` | DataHub web admin | UI only |
| `datahub_nmea_port` | Default **11102** | failover NMEA TCP |
| `PREDICTWIND_USERNAME` / `PREDICTWIND_PWD` | PW cloud account | Optional; not used by NMEA bridge |
| `signalk_host` / `signalk_port` | Signal K server host | `python_scripts/signalk_engines.py` |
| `SignalKUser` / `SignalKPwd` | SK admin account (self-created on first UI visit) | Same |
| `GrafanaUser` / `GrafanaPwd` | Grafana login (forced change from admin/admin) | Interim Mac stack, `OPS.md` §7 |
| `InfluxDBUser` / `InfluxDBPwd` / `InfluxDB` (token) | InfluxDB first-run setup | Grafana data source + write scripts |
| `ColorControlIP` | Victron GX device LAN IP | MQTT-on-LAN, issue #27 |

ESP YAML: `!secret wifi_*` → **Sisu-IoT**; static IPs in each device YAML.  
Access ops: **`OPS.md`**.

Optional later: per-device `api_key_*`, Influx tokens on F8 only.

## Git / GitHub hygiene

| Must stay local (gitignored) | Why |
|------------------------------|-----|
| `homeassistant/secrets.yaml` | Live Wi‑Fi, OTA, SSH, tokens |
| `**/signalk/security.json` | Signal K `secretKey` + users |
| `homeassistant/*.db*` | HA state DB |
| `**/node_modules/` | Vendor trees |
| `homeassistant/esphome/.esphome/` | ESPHome build cache |

Before every push:

```bash
./scripts/scan_secrets.sh
```

Private repo does **not** excuse committing secrets — keys rotate poorly once in git history.

## Signal K plugin-config credentials (no `!secret` equivalent)

`signalk-mqtt-bridge` / `signalk-mqtt-sensors` (`homeassistant/signalk/plugin-config-data/*.json`) have no secret-indirection in their schemas — the MQTT password has to be a literal value for the live plugin to authenticate, and the SK admin UI writes straight to these git-tracked paths. Unlike `secrets.yaml`, these two are **not** gitignored — the surrounding config (topic↔path mappings) is real, evolving, worth keeping in git history, so the whole file isn't thrown away.

Instead: the committed copy of both files stays **permanently credential-free** (`mqttBrokerAddress` with no `user:pass@`, no `mqtt_password` key). `./scripts/signalk-inject-mqtt-creds.sh` reads the broker password already in `secrets.yaml` (`mqtt_broker`/`mqtt_username`/`mqtt_password` — same broker HA's own MQTT integration uses) and writes it onto disk locally after a fresh checkout or container rebuild; restart/reload the SK container afterward. `git checkout -- homeassistant/signalk/plugin-config-data/*.json` restores the safe baseline before you intentionally edit either file's real structure (e.g. adding a sensor mapping) — don't rely on remembering to strip the credential by hand.

`scan_secrets.sh` checks these two paths against **staged** content, not the working-tree file, so the local injection never blocks an unrelated commit — but it still fails hard if the real value is ever actually `git add`ed.

## Do not

- Second secrets file for “HA Wi‑Fi” unless a non-ESP host must join **Sisu**
- Put Guest or main SSID credentials on ESPs
- Expose MQTT / ESP web / Grafana to WAN without VPN
- Commit real `secrets.yaml`, Signal K `security.json`, or inline device passwords
- Paste live passwords into `OPS.md`, issues, or PR comments

## Network policy

See **`NETWORK.md`**: Sisu (Wi‑Fi 7 humans) must reach HA while ESPs stay on Sisu-IoT; router routing required.
