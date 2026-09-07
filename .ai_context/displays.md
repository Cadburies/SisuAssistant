# Vessel displays & HA dashboards

## Separation of concerns

| Display | Role | HA path (start URL) | Primary content |
|---------|------|---------------------|-----------------|
| **Phone / laptop** | General | `/lovelace/default_view` (**Sisu** board) | Status + zone launchers |
| **Saloon tablet** | Water & living | `/lovelace-water` | Tanks, Spectra live + web UI, autorun |
| **Engine room tablet** (optional) | Machinery | `/lovelace-engine` | Alts snapshot, genset |
| **Alternators deep** | Charge control | `/lovelace-alternators` | Production Port/Stbd ESPHome + 3-layer limits (Lab tab = T8 sim only) |
| **Power** | Electrical overview | `/lovelace-power` | Victron-style stubs + solar |
| **Helm browser pane** | Alarms / quick | `/lovelace-helm` | Anchor, house V, links |
| **Weather TWD** | At-anchor wind | `/lovelace-weather-anchor` | TWD/AWS/TWS (`sensor.nmea_*`) + 5min/1h/24h/7d history; roses stay on Grafana WeatherTWD |
| **Sources** | Kernel liveness | `/lovelace-sources` | Per-source data-flow chips (YDWG/DataHub sentence liveness, not TCP-open); boat + internet |
| **Sisu Nav** | Chart + AIS + windex + weather + harvest + isochrone routing + anchorage notes (#76–#80) | `http://<mac-or-f8>:8088` (`sisu-nav/`) | Not HA. SK WS for live data. Spec = GitHub issues **#76–#80**. |
| **Veratron OL43 ×2** | Instruments | **N2K native** | Engine/fuel gauges (not HA) |
| **Built-in Energy** | Daily kWh | sidebar Energy | Needs real kWh sensors |
| **Core Home (Welcome)** | HA system | house-icon Overview | Favorites / Repairs — **not** vessel home |

Dedicated screens should open a **fixed path** (kiosk / Fully Kiosk / wallpanel).

## Two “Overview” entries (important)

| Sidebar | Content | Action |
|---------|---------|--------|
| **House · Overview** | Core HA Home — “Welcome Sisu”, Favorites, Summaries | Hide from sidebar; not ship home |
| **Sisu** (sailboat) | `ui-lovelace.yaml` vessel board | **Set as default dashboard** |

Config style (HA ≥2026.7, required before 2026.8):  
`lovelace.resource_mode: yaml` + `dashboards.lovelace` → `ui-lovelace.yaml`  
(not legacy top-level `mode: yaml`). See `configuration.yaml`.

## Why Alternators & Power are in the sidebar

Deep dashboards (many gauges), not Overview tiles. Overview only **launches** them.

## Area registry (HA Areas)

Vessel areas: Engine Room, Saloon, Helm, Foredeck, Electrical, Lab.  
Navigation: Home zone buttons → dashboards.

## N2K / Victron / Raymarine / Spectra

- Primary instruments stay on **NMEA 2000** (Veratron, engines).
- Victron → future N2K gateway or SK → MQTT → HA (`packages/energy_victron_stubs.yaml`).
- **Spectra** controller on LAN **192.168.0.25** — HA bridge + iframe on Water; treat controls as live machinery.
