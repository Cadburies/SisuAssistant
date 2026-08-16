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
| User float default | **13.5 V** | Float target (Victron factory LFP default) |
| Low orange | **12.0 V** | Getting empty — caution |
| Low red | **11.0 V** | Severe low — danger zone |
| Scale min | **10.0 V** | Display floor |

**Victron reference:** Lithium Smart charge voltage typically **14.0–14.4 V**; factory defaults are absorption **14.2 V** / float **13.5 V** / absorption time **2 h**. Sisu uses **14.4 V hard**, **14.3 V** default absorption (raised from Victron's generic 14.2 V default to line up with this vessel's real BMS NG "Charged voltage" setting — see Victron BMS NG mirror setpoints below), **13.5 V** default float.

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
| `HOUSE_V_CEIL` | 14.4 V | Voltage hard clamp |
| `ALT_T_CEIL` | 125 °C | Temperature hard clamp |

Ceiling diagnostic sensors in ESPHome report **hard** ceilings (not scale max). These three are the only alternator constants that stay hardcoded — everything else the operator can tune (including the Victron BMS NG mirror values below, and the dual-alt house-current budget) is an HA `number` setpoint, never a firmware constant.

---

## Dual-alt shared house current (issues #16 / #62)

Not a fourth hard-cutoff layer. Independent PIDs can otherwise sum to 2× `ALT_I_CEIL` (500 A) into the same bank/cabling. Each board **clamps its requested current** so the pair stays within an operator budget.

**Vessel policy (operator-confirmed, #62):** both 320 A Leece-Neville machines run in parallel at **150 A each** (combined **300 A**). House bank is 5×300 Ah Victron NG LiFePO4; the DC wiring is sized for that combined current. Earlier smaller 250 A-class alts were burned at higher current — `ALT_I_CEIL` stays **250 A** (per-alt hard cut). 220 A per side has been run on the new machines without incident; that is **not** the software limit.

| Layer | Value | Notes |
|-------|------:|-------|
| Default combined budget | **300 A** | `house_i_budget` on each board — set the same number on Port and Stbd |
| Operator max | **300 A** | `number.max_value`; firmware also clamps here |
| Dual-alt local cap | **budget / 2 = 150 A** | Static 50/50 while the peer board is present |
| Single-alt local cap | per-alt user SP, ≤ **250 A** | Peer board explicitly offline — this side ignores the split |

**Single-alt:** if the other Marine Board is offline (`binary_sensor.sisu_alternator{port,starboard}_online` is **off** and that side’s current is unavailable), this board uses the normal per-alt path (`alt_i_sp` / `ALT_I_CEIL`). One engine running can still do 150 A default / 250 A max.

**Peer unknown** (HA API down, or the online helper has no state): same **budget / 2** as dual-alt. Safe combined current; single-alt is degraded to half until HA returns or the peer is seen offline. This is availability, not a safety hole — HA is a *telemetry pipe* for peer liveness, not a control authority. The clamp itself runs locally every 250 ms.

**Not a hard field-cut.** Crossing the combined budget does not latch a fault or force PWM to 0. Per-alt `ALT_I_CEIL` / `HOUSE_V_CEIL` / `ALT_T_CEIL` are unchanged.

Diagnostics: `alt_share_cap_sensor` (amps) and `alt_share_mode_sensor` (`single` / `split` / `conservative`).

---

## Victron BMS NG mirror setpoints (issue #22)

Not a fourth layer — these are operator-set HA numbers that mirror the real Victron BMS NG's own configuration, so the alternator's internal charged→float transition (a **local proxy only**, using alternator shunt current, not the BMS's own battery-current measurement) lines up with when the physical BMS actually syncs SoC to 100%.

| ESPHome id | Meaning | Default | Bounded by |
|------------|---------|--------:|------------|
| `house_v_charged` | Victron BMS NG "Charged voltage" | 14.3 V | Hard ceiling 14.4 V |
| `bms_bank_ah` | Battery bank capacity | 1500 Ah (5×300 Ah) | — |
| `bms_tail_i_pct` | Victron BMS NG "Tail current" (% of bank) | 5.0 % | — |
| `bms_charged_detect_s` | Victron BMS NG "Charged detection time" | 180 s | — |
| `abs_max_min` | Absorption max-time backstop (not a BMS value — prevents holding LFP at absorption voltage forever under sustained house load) | 120 min | — |

If the real BMS NG settings are changed on the vessel, update these four HA numbers to match — they are not re-derived automatically.

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

**How to test and tune the cascaded PI** (do not replace the law; do not raise the three ceilings): [`ALTERNATOR_TUNING.md`](ALTERNATOR_TUNING.md).
