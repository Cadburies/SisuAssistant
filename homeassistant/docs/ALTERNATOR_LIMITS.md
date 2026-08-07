# Alternator & house-bank gauge limits (authoritative)

**Do not collapse “rated / scale max” with “hard safety ceiling”.**  
Future agents: change numbers only here and mirror into ESPHome + dashboards.

## Three layers

| Layer | Meaning | Who owns it | Gauge / control |
|-------|---------|-------------|-----------------|
| **1. Scale max** | End of needle — physical/rated/theoretical | Spec sheet | `gauge.max` |
| **2. Hard ceiling** | Must not exceed — control clamp + **start of RED** | Vessel safety policy | `severity.red` + firmware `*_CEIL` |
| **3. User setpoint** | Normal operating target — **start of ORANGE** | Operator (HA number) | `severity.yellow` (live) + ESPHome `number` |

High-side band layout:

```text
0 ── green ── [user SP] ── orange ── [hard ceiling] ── red ── [scale max]
```

- User setpoints **must not be settable above** hard ceiling (`number.max_value` = hard).
- Firmware **clamps / field-cuts at hard ceiling**, never only at scale max.

---

## Alternator current (Leece-Neville ~320 A)

| Layer | Value | Notes |
|-------|------:|-------|
| Scale max | **320 A** | Nameplate / rated output |
| Hard ceiling (red) | **250 A** | Vessel continuous safety limit |
| User setpoint default (orange) | **150 A** | Adjustable in HA |

---

## House voltage (Victron LiFePO4 12 V class)

| Layer | Value | Notes |
|-------|------:|-------|
| Scale max (high) | **14.7 V** | Theoretical / near full cell-stack high |
| Hard ceiling high (red) | **14.4 V** | Victron max charge band (do not target above) |
| User absorption default (orange high) | **14.3 V** | Charge target |
| User float default | **14.1 V** | Float target |
| Low orange | **12.0 V** | Getting empty — caution |
| Low red | **11.0 V** | Severe low — danger zone |
| Scale min | **10.0 V** | Display floor |

**Victron reference:** Lithium Smart charge voltage typically **14.0–14.4 V**, absorption often **~14.2 V recommended**. Sisu uses **14.4 V hard**, **14.3 V** default absorption.

**Stock HA needle gauge** severity is one-directional (low→high). High-side orange/red is on the main gauge. Low-side bands are documented here and surfaced as status helpers; do not expect a single stock gauge to paint both 11 V red and 14.4 V red.

---

## Alternator temperature

| Layer | Value | Notes |
|-------|------:|-------|
| Scale max | **150 °C** | Display headroom (LN/Prestolite families often marketed 110–125 °C class) |
| Hard ceiling (red) | **125 °C** | **Vessel safety** — field cut / alarm |
| User setpoint default (orange) | **95 °C** | Thermal derate / limit target |

Leece-Neville / Prestolite catalogs cite **110 °C** or **125 °C** high-temperature rated lines. Our **hard** ceiling is always **125 °C** regardless of marketing class; scale goes to **150 °C** so red has a visible band.

---

## Firmware constants (must match)

| Constant | Value | Used for |
|----------|------:|----------|
| `ALT_I_CEIL` | 250 A | Current hard clamp |
| `HOUSE_V_CEIL` / `VBUS_HARD_CEILING` | 14.4 V | Voltage hard clamp |
| `ALT_T_CEIL` | 125 °C | Temperature hard clamp |

Ceiling diagnostic sensors in ESPHome report **hard** ceilings (not scale max).

---

## Files that must stay in sync

| File | What |
|------|------|
| `homeassistant/docs/ALTERNATOR_LIMITS.md` | **This document (source of truth for intent)** |
| `Technical Specifications.md` | Safety / charge section summary |
| `OPS.md` | Operator pointer + dual Overview note |
| `homeassistant/dashboards/alternators.yaml` | Gauge max / red / live yellow |
| `homeassistant/esphome/packages/marine_alternator.yaml` | Production clamp + number max |
| `homeassistant/esphome/bench_alts_sim.yaml` | Lab sim clamp + number max |
| `homeassistant/packages/sim_production_aliases.yaml` | Template number max for aliases |

When changing a limit: update this file first, then all rows in the table.
