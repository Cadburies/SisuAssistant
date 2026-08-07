# Secrets & security pointers

Pointers only. **Never** paste live passwords into context docs, commits, or issue comments.

## One boat secrets file

| Path | Used by |
|------|---------|
| `homeassistant/secrets.yaml` | Home Assistant + ESPHome (`esphome/secrets.yaml` symlink) — **gitignored** |
| `homeassistant/secrets.yaml.example` | Template committed to git (`CHANGE_ME` only) |

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

## Do not

- Second secrets file for “HA Wi‑Fi” unless a non-ESP host must join **Sisu**
- Put Guest or main SSID credentials on ESPs
- Expose MQTT / ESP web / Grafana to WAN without VPN
- Commit real `secrets.yaml`, Signal K `security.json`, or inline device passwords
- Paste live passwords into `OPS.md`, issues, or PR comments

## Network policy

See **`NETWORK.md`**: Sisu (Wi‑Fi 7 humans) must reach HA while ESPs stay on Sisu-IoT; router routing required.
