# Sisu Marine Automation — Installation Manual

**Version:** 1.6 · September 2026  
**Audience:** installer, owner, commissioning engineer, coding agent  
**Status:** living document — keep in sync with firmware and vessel policy  

| Related document | Role |
|------------------|------|
| `NETWORK.md` | Router, SSIDs, IPs, firewall |
| `OPS.md` | Agent deploy, HA Green access |
| `Technical Specifications.md` | System-level functional specs |
| `MarineBoard/Technical Specs.md` | PCB pins, connectors, ratings |
| `homeassistant/docs/ALTERNATOR_LIMITS.md` | Scale / hard / user setpoint policy |
| `homeassistant/docs/ALTERNATOR_TUNING.md` | How to step-test / retune cascaded PI (keep the law) |
| GitHub Issues (`gh issue list`) | Open software work (see `CLAUDE.md`) |
| `.ai_context/safety.md` | Electrical control invariants |

---

## 1. Project overview

### 1.1 Intent

**Sisu Marine Automation** instruments and controls vessel electrical and water systems on yacht **Sisu**:

- Dual high-output **Leece-Neville ~320 A** alternators (Port / Starboard) charging a **Victron LiFePO4** house bank under a **Victron BMS NG**
- Fresh-water tank levels (and house voltage at saloon)
- Freezer / fridge climate control
- Spectra Newport watermaker integration via LAN
- Unified operator UI + MQTT kernel on **Home Assistant Green**, with Signal K / Grafana / Influx on **TerraMaster F8** (Mac until #6)

### 1.2 Design principles

1. **Safety is layered** — BMS protects the pack; Marine Board regulates alternator field; hardware field stage defaults **off**; HA is for setpoints and monitoring, not the last trip path.
2. **Local control on the edge** — Alternator PID and hard cutoffs run on the ESP32 even if Wi‑Fi or HA drops.
3. **Humans stay on SSID Sisu** — Phones open HA without joining the IoT SSID; ESPs live on **Sisu-IoT**.
4. **Helm instruments stay on N2K** — Veratron / Raymarine are not dependent on HA for primary gauges.
5. **One role per board type** — Marine Board = alts + levels; freezer stays on LilyGo AMOLED unless explicitly redesigned.

### 1.3 Major components

| Component | Address / ID | Function |
|-----------|--------------|----------|
| HA Green | `192.168.0.20` | Home Assistant, ESPHome, MQTT kernel (`core_mosquitto` + `logins:`) |
| TerraMaster F8 | `192.168.0.21` | Signal K, Grafana, Influx, **Sisu Nav** `:8088` (production target; Mac until #6). Phase 1 #76: `http://<mac-lan-ip>:8088` |
| GL.iNet GL-BE9300 | LAN router | Sisu / Sisu-IoT routing |
| Alternator Port board | `192.168.10.41` | Field + shunt + temp · Port |
| Alternator Starboard board | `192.168.10.42` | Field + shunt + temp · Stbd |
| Water levels board | `192.168.10.43` | Tank loops + house V · Saloon |
| Freezer (LilyGo) | `192.168.10.44` | Fridge/freezer climate + display |
| Lab dual-alt sim (T8-S3) | `192.168.10.49` | Dashboard/lab only — **not** production field |
| Spectra Newport 400c | `192.168.0.25` | Watermaker (WS bridge from HA) |
| Victron BMS NG | VE.Bus / system | Pack charge authority |

### 1.4 Firmware map

| Role | Entrypoint | Packages / notes |
|------|------------|------------------|
| Alt Port | `homeassistant/esphome/alternatorport.yaml` | `marine_board_base` + `marine_alternator` |
| Alt Stbd | `homeassistant/esphome/alternatorstarboard.yaml` | same |
| Levels | `homeassistant/esphome/waterlevels.yaml` | `marine_board_base` + tank sensors |
| Freezer | `homeassistant/esphome/freezer.yaml` | LilyGo S3 AMOLED |
| Spectra | `python_scripts/spectra_ws.py` + `packages/spectra_newport.yaml` | Not ESPHome |

---

## 2. Safety philosophy (read before any power work)

### 2.1 Layers

| Layer | What it protects | Who owns it |
|-------|------------------|-------------|
| **Pack** | Cells, BMS trip, charge permit | **Victron BMS NG** |
| **Alternator regulation** | Current, local bus V, alt temp, stages | **Marine Board firmware** |
| **Field power stage** | Fail-safe default off, fuse, freewheel | **PWM DRIVERS** hardware |
| **Sensing** | Alt amps + house V | **INA226 + external shunt** |
| **Operator UI** | Setpoints, visibility | **Home Assistant** |

Marine Board defaults and hard ceilings **must match** BMS NG charge policy. Authoritative numbers: `homeassistant/docs/ALTERNATOR_LIMITS.md`.

### 2.2 Global must-dos

1. **Isolate power** before connecting field, shunt, or 12 V to CN1/CN2.  
2. First engine-room bring-up is **shadow** (sensors only, field PWM not on the alt — eMax still regulates). See §6.4.  
3. **USB-C does not power** relay, PWM load, or 4–20 mA loops — connect **12 V** on CN1. OTA after first flash; USB is not required for tuning.  
4. All ESP GPIOs are **3.3 V only**.  
5. Start charge setpoints **low** (e.g. 50–80 A) on first sea trial after Shadow is off; raise only after logging (`docs/ALTERNATOR_TUNING.md`).

### 2.3 Global must-nots

1. Do not raise hard ceilings (250 A / 14.4 V / 125 °C) without electrical review + BMS NG revalidation.  
2. Do not expose MQTT, HA, Grafana, or ESP web UI to the public internet without VPN.  
3. Do not put unvalidated Marine Board CAN traffic on the Raymarine backbone until proven offline.  
4. Do not use lab sim IP `.49` as a production field driver.

---

## 3. Network & infrastructure (summary)

Full detail: **`NETWORK.md`**.

### 3.1 Overview

| SSID / link | Subnet | Clients |
|-------------|--------|---------|
| **Sisu** | `192.168.0.0/24` | Phones, HA, F8, Spectra |
| **Sisu-IoT** (2.4 GHz) | `192.168.10.0/24` | All ESP32s |
| Ethernet | same as Sisu LAN | HA Green, F8 |

**Required:** router allows **HA `192.168.0.20` → `192.168.10.0/24`** so ESPHome API works while humans stay on Sisu.

### 3.2 Installation checklist

1. Configure SSIDs and passwords from `secrets.yaml` (`sisu_wifi_*` for humans, `wifi_*` for IoT).  
2. Static / DHCP reservation: `.20` HA, `.21` F8, `.41–.44` ESPs, `.49` lab.  
3. Firewall: LAN → IoT for HA (and any admin hosts you choose).  
4. Verify: from a laptop on Sisu, open `http://192.168.0.20:8123` and ping/API to an ESP on `.10`.  
5. Do **not** port-forward HA/MQTT/ESP to WAN.

### 3.3 Troubleshooting

| Symptom | Check |
|---------|--------|
| ESP “online Wi‑Fi” but HA **unavailable** | Firewall LAN→IoT; static IP/gateway `192.168.10.1` |
| HA cannot flash OTA | Same route; encryption key match; device not asleep |
| Spectra offline | Spectra on **.0** LAN (`.25`), not IoT subnet |

---

## 4. Home Assistant Green

### 4.1 Overview

HA Green is the vessel’s automation host: dashboards, ESPHome integration, Spectra bridge, and the MQTT kernel (`sisu/v1` on official `core_mosquitto` with `logins:` for SK/ingest).

### 4.2 Specs / paths

| Item | Value |
|------|--------|
| IP | `192.168.0.20` |
| UI | `http://192.168.0.20:8123` |
| Config root | `/config` (deploy from Mac via `scripts/ha-deploy-config.sh`) |
| Vessel board | `ui-lovelace.yaml` (sidebar **Sisu**) |
| Role UIs | `/lovelace-water`, `/lovelace-alternators`, … |

### 4.3 Installation / bring-up

1. Ethernet to LAN (Sisu subnet).  
2. Complete onboarding; enable **Advanced SSH** (port **22**, user `sisu`).  
3. Install **ESPHome** add-on; adopt devices by IP + API key.  
4. Deploy repo configs: `./scripts/ha-deploy-config.sh`.  
5. Kernel MQTT + ingest: put `mqtt_username` / `mqtt_password` in `secrets.yaml`, then `./scripts/ha-kernel-mqtt.sh` (official **Mosquitto** add-on + `logins:` + local add-on **Sisu NMEA ingest**). Ingest is Supervisor-managed (`local_sisu_nmea_ingest`, host network): YDWG `192.168.10.30:1456` + DataHub `192.168.10.31:11102` → MQTT `sisu/v1`. HA MQTT integration → `192.168.0.20:1883` with those creds. First install builds the image on Green (a few minutes). Check: **Settings → Apps** → Sisu NMEA ingest → Log shows `MQTT connected` and both gateways; HA `sensor.nmea_aws` updates; `binary_sensor.source_ydwg` on when YDWG is speaking.  
6. Set default dashboard to **Sisu** vessel board (not core “Welcome” Home).  
7. Optional: long-lived token in `secrets.yaml` as `ha_token`.

### 4.4 Safety recommendations

- Treat **Alternators** and **Water → Spectra** controls as live machinery UIs.  
- Leave **Shadow measure-only** ON until I/V/T check out against the existing regulator.

### 4.5 Troubleshooting

| Symptom | Check |
|---------|--------|
| Deploy fails | SSH key/password; sudo; Advanced SSH running |
| Dashboard custom card error | `config-template-card` under `/config/www/community/…` + `resource_mode: yaml` |
| MQTT publish errors | Install MQTT integration → broker `192.168.0.20` (`mqtt_username` / `mqtt_password`) |
| `sensor.nmea_*` unavailable / source chips off | **Settings → Apps** → Sisu NMEA ingest (started?); `./scripts/ha-kernel-mqtt.sh`; Green must reach `.30:1456` and `.31:11102` |
| Supervisor “Unsupported software” | leftover unofficial images/containers (`sisu-nmea-ingest`, `eclipse-mosquitto`, `signalk`) — `./scripts/ha-kernel-mqtt.sh` removes them; ingest must be the local add-on |

---

## 5. Sisu Marine Board (general)

### 5.1 Overview

The **Sisu Marine Board** (ESP32-S3-WROOM-2-N32R16V) is the vessel I/O node for **alternators** and **tank levels**. It is not a display host.

Schematic authority: `MarineBoard/` (PNGs + `Technical Specs.md`).

### 5.2 Key connectors

| Ref | Function |
|-----|----------|
| **CN1** | Battery in: GND, +12 V BAT |
| **CN2** | PWM: +12 V BAT, PWM1 (field low-side) |
| **U4** | Shunt sense: SH−, SH+ (mV only — Kelvin pair) |
| **U13** | ENBL, RPM, TMP1 (DS18B20) |
| **U5 / U6** | 4–20 mA loops LVL1 / LVL2 + loop +12 V |
| **U7** | CAN: CANL, CANH, GND |
| **CN3** | I²C Qwiic (3.3 V) |
| **J1** | USB-C program / serial |
| **U9** | Logic out +3.3 V / +5 V (limited) |

### 5.3 Power

1. Fit input fuse per design (blade F1 class on 12 V input).  
2. Connect CN1 to fused house/engine 12 V **after** reverse polarity / TVS protection on board.  
3. USB-C for flash only until 12 V is applied for PWM/loops.  
4. Confirm LED/buzzer smoke test after first power-up.

### 5.4 Flash / network

1. USB-C: hold **Boot**, tap **Reset** → download mode.  
2. Flash with ESPHome (Mac CLI or HA ESPHome add-on).  
3. Wi‑Fi: **Sisu-IoT**, static IP per role (`.41–.43`).  
4. I²C scan expect **0x40** (battery), and **0x41 / 0x45** if level monitors populated.  
5. Adopt in HA ESPHome integration.

### 5.5 Safety must-dos (board)

1. Confirm **default field off** before connecting field coil (PWM low, ENBL open).  
2. Never feed 5 V into ESP GPIOs.  
3. CAN termination (**JP1**) only if this node is a bus end.  
4. Keep documentation PNGs in sync after schematic edits.

### 5.6 Troubleshooting (board)

| Symptom | Check |
|---------|--------|
| No I²C devices | 12 V + 3.3 V rails; SDA/SCL 40/41; address straps |
| Brown-outs when PWM on | 12 V supply capacity; CN1 wiring; ground integrity |
| Opto inputs never true | Field-side polarity of ENBL/RPM LEDs; ESD path |

---

## 6. Alternators (Port & Starboard)

### 6.1 Overview

Each engine-side Marine Board is an **external field regulator**:

- Measures **alternator current** (external 400 A / 75 mV shunt) and **house VBus** (INA226 U2)  
- Measures **alternator temperature** (DS18B20 on TMP1)  
- PWM-controls field via CN2  
- Stages: bulk → absorption (amp taper) → charged  
- Hard cutoffs: **250 A**, **14.4 V**, **125 °C** (see limits doc)  
- Pack authority remains **Victron BMS NG** (same ceilings; charge permit / disconnect)

Firmware: `packages/marine_alternator.yaml`.

### 6.2 Specs (install-relevant)

| Item | Spec |
|------|------|
| Alternators | Leece-Neville ~**320 A** / 12 V (nameplate / gauge scale) |
| Rectification | **None internal.** Bare 3-phase machine: only the three phase (stator) outputs, field control leads, and ground are brought out. The alternator's own **12 V output terminal exists but is not connected/used**. An **external 1000 A-peak bridge rectifier** (installed outside the alternator) is wired to the three phase leads and does all rectification for this installation. See §6.3.7 — this is a fixed hardware fact for this install, not a to-be-decided item. |
| Continuous policy hard | **250 A** per side |
| Default current SP | **150 A** |
| House absorption / float defaults | **14.3 V** / **14.1 V** |
| House hard V | **14.4 V** (Victron band max) |
| Temp soft / hard | SP default **95 °C** / hard **125 °C** |
| Field path | Opto → TC4427 → MOSFET, freewheel diode, **F3 15 A** class |
| Control loop | 1 Hz local PID + hard trips |
| ENBL | Opto input GPIO8 — field off when inactive |
| IPs | Port **.41**, Starboard **.42** |

### 6.3 Hardware installation guide

#### 6.3.1 Shunt (current)

1. Use a **400 A / 75 mV** shunt rated for continuous duty at your policy current.  
2. Place shunt in the **alternator B+ output path** you intend to limit (not a random house branch).  
3. Run **twisted Kelvin pair** from shunt sense pads to **U4 SH+ / SH−** — sense only, no load current in sense wires.  
4. Keep sense wires short and away from ignition/coil noise where possible.  
5. After power-up, verify HA current ≈ clamp meter at known load.

#### 6.3.2 House voltage sense

1. INA226 **Vbus** is taken from the shunt high-side network — the shunt high side must be on the **house bus** node you care about (after main feed, consistent with BMS “charge bus” view as far as practical).  
2. Avoid sensing on a long thin drop that does not represent cell/bus voltage under charge.

#### 6.3.3 Field (PWM)

1. Field coil between **+12 V BAT** and **PWM1** (low-side switch), CN2.  
2. Confirm freewheel path (on-board D14) remains effective with your harness length; add external suppression at the alt if the maker requires it.  
3. Fuse the field/supply per design (**15 A** class on board path); add external protection as needed for cable gauge.  
4. **Before first engine start:** ENBL open or false → field duty must stay **0 %**.

#### 6.3.4 Temperature

1. Mount DS18B20 on the **alternator case / specified temp point** (not free air in the engine room).  
2. Use TMP1 on **U13**; observe ESD/series protection on board.  
3. Validate reading rises with load; set soft SP (e.g. 95 °C) below hard 125 °C.

#### 6.3.5 ENBL (run / allow)

1. **Wiring recipe** — ENBL is a single opto input; there is no second interlock in firmware today (see issue #12), so combine both conditions **before** the ENBL pin, not in software:
   - Engine-run signal (ignition / oil pressure switch / D+) **AND**
   - BMS charge-allow / ATC / charge-path-closed contact (recommended — see §6.3.6)
   - **AND** the two mechanically/electrically (relay coil in series, or a 2-input AND gate/relay logic module) so ENBL only asserts when **both** are true. Do not wire only engine-run and rely on the BMS to open the DC path elsewhere — see R30.
2. Opto input: respect field-side LED polarity on the ENBL circuit.
3. Opening ENBL must force firmware field **0** (already implemented — `marine_alternator.yaml`, `enabled` check).
4. If a future board revision adds a second physical interlock input, firmware would then be able to report *which* condition is missing (e.g. "engine run, no charge-allow") — until then, ENBL going false is reported simply as `Disabled: ...` with no reason breakdown, so the AND-gate wiring above is what keeps the vessel safe, not firmware status text.

#### 6.3.6 Victron BMS NG coordination

1. Configure BMS NG charge voltages and limits to match **`ALTERNATOR_LIMITS.md`** (14.4 V hard class, etc.).  
2. Marine Board defaults (13.5 V float / 14.3 V abs / 150 A per side) are **derived from** that policy — do not drift them independently.  
3. Confirm what happens on BMS charge disconnect: ideally **ENBL goes false** or charge path feedback opens so the alt is not left field-high into an open circuit.  
4. Dual alts: both boards charge the same bank. Firmware applies a **shared house-current budget** (`house_i_budget`, default **300 A**): while the other board is online each side’s request is capped at **150 A**. One board offline → that side takes the full per-alt SP / 250 A ceiling. Set the same budget number on Port and Stbd. See `ALTERNATOR_LIMITS.md` (issues #16/#62). Per-side SPs still should not be raised casually — the split is a request clamp, not a new hard field-cut.

#### 6.3.7 RPM sensing (stator tap) — hardware fact + protection (issue #13)

**Fixed hardware fact, do not re-derive or re-ask:** this alternator has **no internal rectifier and no manufacturer-provided low-level tach/"R"/"stator" terminal**. Only three phase (stator) leads, field control, and ground are brought out; the 12 V output terminal is unused/not connected. Rectification is done entirely by a **1000 A-peak bridge rectifier external to the alternator**, wired to the three phase leads. See §6.2.

Consequence: any RPM signal for `rpm_count`/`RPM_GPIO` (`packages/marine_alternator.yaml`, `MarineBoard/Documentation/IO PROTECTION.png` — R16/D8/U10) tapped **directly off a phase winding lead** is a genuinely raw, high-current-capable tap point — not a buffered OEM sense point. Treat it accordingly:

1. **Chosen approach: tap ripple on the DC side of the external bridge, not a raw phase lead.** That DC node is the same one the 5×12V/300A Victron LiFePO4 house bank is connected to (battery-buffered under normal running) — but the fault case that matters is the battery disconnecting while the field is still excited (R30: BMS/ATC opening the charge path mid-charge), which the battery obviously can't clamp at the exact moment it happens. Design for that, not for "battery always present."

   **Circuit (replaces R16/D8 on the RPM channel only — ENBL/U14 unaffected):**
   ```
   House DC bus (13-14.4V) -[C1]- node -[R_bias to GND]
                                    -[R16': 2.2k, >=1W]- node -[D_new to GND]- U10 pin1 (LED anode)
   U10 pin2 (LED cathode) -- GND (unchanged)
   ```
   - **C1**: 1 µF, film or X7R ceramic rated >=50V (oversize the voltage rating if ceramic — X7R capacitance sags under DC bias). Blocks the DC offset entirely so the opto only ever sees the AC ripple, not a sustained 13-14.4V. Sized so the R16'-C1 high-pass corner (~72 Hz at these values) sits below idle ripple frequency (6-pulse rectification, roughly hundreds of Hz at idle up to several kHz at speed) so idle-speed signal isn't attenuated away.
   - **R_bias**: 47-100 kΩ to GND at the AC-coupled node — defines a DC reference/bleed path so the node doesn't float; large enough relative to R16' that it doesn't load the ripple signal.
   - **R16'**: 2.2 kΩ, >=1 W (up from the original 1 kΩ) — still the primary protection element. The LED self-clamps its own forward voltage at ~1.3 V, so the resistor is what limits *current* into it. At a conservative 35-50 V worst-case fault (reduced from the ~100 V raw-winding design basis given the battery's normal low impedance plus the alternator firmware's own 14.4 V hard-trip+latch, issue #14, both working against a fault persisting) that's ~15-22 mA — comfortable margin under the 50 mA LED abs. max.
   - **D_new**: ~6.8 V bidirectional automotive TVS (P6KE6.8CA / SMAJ6.8CA class — 400-600 W, proportionate for a small-signal node; the 1500 W 1.5KE-series parts considered for the raw-tap case are not needed once tapping the buffered bus). Protects the LED's reverse side (6 V max, no self-protection there) against negative ripple and any fault energy that couples through C1 despite the cap.
   - **Verify on the bench before trusting it**: scope the AC-coupled signal across idle-to-max RPM, and confirm `rpm_count`/`RPM_GPIO` shows clean pulse transitions in the ESPHome log — R16' may need adjusting once the real ripple amplitude for this specific rectifier/battery combination is known (not published anywhere, no substitute for measuring it).
   - **Physical tap point**: `SH+` on `MarineBoard/Documentation/12V BATTERY MONITOR.png` (U2 INA226 shunt/Vbus circuit) — same electrical node as the house DC bus (R7 is only 10Ω, negligible drop). This is a **not** a bare-wire connection: C1's first leg lands on `SH+` (or equivalently the Vbus-side filter node — same node); C1's *other* leg is what becomes the `RPM` net feeding into R16'/U10 in the IO_PROTECTION circuit. Do not skip C1 and wire `SH+` straight to the existing `RPM` net — with no AC-coupling the opto LED sees a continuous 13-14.4V DC bias, saturates permanently, and produces no pulses at all (not a fault-current problem, just a non-functional tachometer). Draws negligible current off `SH+` (µA-mA range through C1 into a few kΩ) — does not meaningfully load the 400A shunt path; only care needed is mechanical (land on a solid joint, don't disturb the shunt's main current-carrying terminal).
   - **Sourced parts (verified against spec, 2026-08-09):** `P6KE6.8CA` 600W DO-15 (=D_new, exact match), 1.2kΩ 2W 1% metal film (=R_patch, exceeds the ≥1W requirement), 68kΩ 2W 1% metal film (=R_bias, within the 47-100kΩ range), **1µF 100V metallized polyester film capacitor (CL21 series, "105J" code) for C1** — exact type match (film, non-polarized — no orientation risk, unlike the electrolytic considered earlier), correct value, more voltage headroom than the ≥50V requirement. All four parts confirmed as sourced; no substitutions or workarounds needed. **This is the interim external-patch part list — follow it for the currently-fabricated prototype board.**
   - **PCB rev 2 (not yet fabricated) — formalized on-schematic version (issue #26):** this circuit has been re-derived into real components on `MarineBoard/MarineBoard.kicad_sch` (IO_PROTECTION sheet) for the next PCB spin, so it stops being a permanent external bodge. Reference designators: **C33** (1.2 µF 100V, `Capacitor_SMD:C_1210_3225Metric` — replaces the interim CL21 film C1), **R37** (100 kΩ, `easyeda2kicad:R0805` — replaces the interim 68kΩ R_bias), **R45** (2.2 kΩ ±1% 2W, 2512 package — replaces `R16` **outright**; R16 is retired from the schematic, not repurposed), **U20** (SMAJ6.8CA, `EasyEDA:SMA_L4.4-W2.6-LS5.0-BI` — replaces the interim P6KE6.8CA D_new; existing `D8` kept as-is). Component values are the final selection for rev 2, not an exact match to the interim patch parts above. `MarineBoard.csv` BOM reflects these. Still open regardless of parts revision: regenerate `Documentation/IO PROTECTION.png` from the schematic, and bench-scope `SH+` ripple amplitude idle→max RPM before retiring the interim patch on any board.
   - **Do not repurpose the INA226/U2 itself for this** — its `adc_time`/`adc_averaging` config (1100µs × 16 ≈ 17.6ms per reading, further gated by a 250ms ESPHome `update_interval`) and its analog front-end filtering (R7 10Ω + C10 4.7µF + C9 0.1µF, ~3.4kHz corner) exist specifically to reject ripple for clean house_v/alt_i control-loop readings — the opposite of what a tachometer needs. Tap the same node, but feed the *new* dedicated RPM circuit (which uses the ESP32's hardware pulse-counter peripheral on GPIO4, not I2C polling), not the existing INA226 sensor path.
2. **If tapping a raw phase lead directly is ever needed instead** (not the chosen approach, kept for reference): a series resistor is **not optional** — a TVS/Zener clamp alone does not limit current, only voltage; without a resistor the winding's low source impedance can drive far more current into the clamp (and everything downstream) than it can survive, in both fault *and*, if the clamp voltage is set too low, **normal running** too.
   - Normal operating peak on a raw tap is not published by the OEM and was not empirically measured as of this writing — **verify with an oscilloscope** (not a multimeter, which only shows an average) across the real idle-to-max RPM range before committing to final component values.
   - Do not use a low-standoff part (e.g. ~16 V) sized only against a rough system-voltage guess — if the real normal peak exceeds the clamp's standoff, it conducts every cycle during ordinary operation, not just during a fault, and cooks itself on day one regardless of pulse power rating.
   - Common small-signal automotive TVS "1500 W" axial parts (e.g. 1.5KE-series, DO-201AD) are rated **1500 W only at a 10/1000 µs pulse** — their continuous/steady-state rating is around **6.5 W**. A real alternator load-dump event runs ~100–400 ms (100–400× longer than the rated test pulse), so treat sustained capability as much closer to the steady-state figure, not the headline peak-pulse number.
   - Paralleling multiple TVS/Zener units for more power does **not** reliably multiply capability unless each branch has its own ballast resistor — unit-to-unit breakdown-voltage tolerance means the lowest-Vbr unit in a bare parallel bank conducts first and disproportionately, so the bank does not share current evenly without ballasting.
   - Full research thread + specific numeric worked example: issue **#13** comment history.

#### 6.3.8 Mechanical / electrical

1. Alternator belt condition and tension for continuous high output.  
2. Cable gauge for 250 A continuous with margin; torque lugs; anti-corrosion.  
3. Ground integrity between engine block, shunt, and house negative.

### 6.4 Software install / commission (shadow, then take over)

Do this **one side at a time**. The existing regulator (eMax / factory / whatever is on the field today) stays in control until Phase C.

**Phase A — wire sense only (engine off, isolate)**

1. 12 V to the Marine Board (CN1). USB-C is data only.  
2. Connect **house V**, **alternator shunt** (Kelvin on U4), **DS18B20** on the alt body, RPM tap if you have it.  
3. **Do not** connect the Marine Board field PWM to the alt. Leave the eMax (or current regulator) field wire on the machine.  
4. Flash `alternatorport.yaml` / `alternatorstarboard.yaml` (USB first time; OTA after). **Shadow measure-only** defaults **ON** — firmware forces field duty to 0 even if ENBL is closed.  
5. Adopt in HA. Confirm switch **Shadow measure-only** is on. `alt_msg` should start with `SHADOW`.

**Phase B — shadow calibration (eMax still regulating)**

1. Engine run as you normally would. eMax charges; Marine Board only listens.  
2. Compare, at a few load points (idle, cruise, a load step):

   | Quantity | Marine Board | Check against |
   |----------|--------------|---------------|
   | Alternator current | `sensor.alternator{port,starboard}_alternator_current_*` | Clamp meter on the output cable, or eMax / Victron if they show alt I |
   | House voltage | `sensor.alternator*_house_voltage_engine_*` | Victron GX / BMS pack V (expect tens of mV, not 0.3 V) |
   | Alt temperature | `sensor.alternator*_alternator_temperature_*` | IR thermometer on the same mass as the DS18B20 |
   | RPM (if wired) | pulse count | Tach / known idle |

3. If current is scaled wrong, fix the INA226 shunt factor in firmware — do not “tune PI” to hide a cal error.  
4. Field duty on the board must stay **0 %**. **Shadow Field Command** may move (what the PI *would* have asked for); that is diagnostic only.  
5. Log the comparison table on the #11 thread. Do not proceed if I or V is nonsense.

**Phase C — take over the field**

1. Engine **off**. Isolate.  
2. Disconnect eMax field from the alt. Connect Marine Board field (GPIO38 / PWM1 MOSFET) to the field terminal. Confirm freewheel / suppression.  
3. In HA: **Shadow measure-only → OFF**.  
4. Engine off, ENBL false: field **0 %**.  
5. Engine run, ENBL true, SP **50 A**: current should track. Then follow **`homeassistant/docs/ALTERNATOR_TUNING.md`**.  
6. Only then raise SP toward 150 A. Never force a hard trip on a loaded bank without a plan.

### 6.5 Safety recommendations (hardware)

1. Prefer **BMS charge-allow ANDed into ENBL** (or separate interlock).  
2. Independent **alternator output fuse/breaker** sized to cable and policy.  
3. Keep field harness short; support inductive suppression.  
4. Label Port vs Stbd boards and shunts clearly.  
5. After any BMS firmware/settings change, re-check board setpoints still match.

### 6.6 Safety must-dos (hardware)

1. **Shadow ON** until Phase B numbers agree.  
2. **No field** with ENBL open (and none from this board while Shadow is on).  
3. Shunt **Kelvin** sense only on U4.  
4. Hard ceilings not raised without review.  
5. First live trials at **50 A**.  
6. Stop immediately on unexpected field % with engine stopped, smell of insulation, or BMS alarms.

### 6.7 Troubleshooting (alternators)

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Field always 0 | ENBL false; error state; no 12 V on CN1 | Check ENBL, status text, 12 V |
| Current reads 0 under load | Shunt wiring; inverted SH+/SH−; wrong path | Clamp meter; reverse sense pair; move shunt |
| V high, BMS alarms | Setpoints above BMS; dual-alt fight; sense location | Lower abs SP; check BMS log; sense point |
| Temp invalid / NaN | 1-Wire open | Field off by design until fixed |
| Oscillating current | PID / belt / load steps | Lower SP; check belt; review logs |
| HA setpoints ignored | Device offline; wrong entity | API connectivity; side Port/Stbd |
| Smells / hot MOSFET | Overcurrent field path; shorted field | Kill ENBL & 12 V; inspect CN2 |

### 6.8 Software follow-ups

Tracked as **GitHub Issues** (firmware / safety-critical labels): INA226 Alert pin (#19), sea-trial logging helpers (#17). Dual-alt shared budget is **#16** (firmware in `marine_alternator.yaml`). See `CLAUDE.md`.

---

## 7. Water levels (saloon Marine Board)

### 7.1 Overview

One Marine Board at **saloon** measures:

- Fresh water **Aft** and **Fwd** tank levels (4–20 mA)  
- **House voltage** at saloon (U2 VBus) for drop/corrosion diagnostics vs engine-room boards  

IP: **192.168.10.43** · firmware `waterlevels.yaml`.

### 7.2 Specs

| Item | Spec |
|------|------|
| Loops | LVL1 **U5** (INA 0x41), LVL2 **U6** (INA 0x45) |
| Sense | 3.9 Ω on-board |
| Sensors | 2-wire 4–20 mA, 12 V loop (e.g. SW-LT100 class) |
| Mapping | 4 mA ≈ 0 %, 20 mA ≈ 100 % (calibrate on vessel) |
| Tanks (Sisu) | Forward **400 L**, Aft **400 L** (policy for Spectra smart fill) |

### 7.3 Installation guide

1. Mount board with 12 V on CN1 and Wi‑Fi to Sisu-IoT.  
2. Wire each transmitter: loop supply from board **+12 V**, return into LVL1/LVL2 per connector.  
3. Observe polarity and shield practice for long runs in bilge/saloon.  
4. Flash `waterlevels.yaml`; adopt in HA.  
5. Calibrate empty/full: adjust firmware mapping or physical sensor height after first fill.  
6. Compare **House Voltage · Saloon** to Port/Stbd house V under load (corrosion / drop).

### 7.4 Safety recommendations

1. Loop supply is 12 V — fuse and strain-relief cables in wet areas.  
2. Do not inject 4–20 mA into U4 shunt pins.  
3. Until calibrated, do not rely on % for critical “tank empty” automation alone.

### 7.5 Safety must-dos

1. Isolate 12 V before service on loop wiring.  
2. Verify mA at empty/full before trusting Spectra auto-stop.

### 7.6 Troubleshooting

| Symptom | Check |
|---------|--------|
| Level stuck 0 % or 100 % | Loop open/short; 4–20 mA span; sensor supply |
| Noisy % | Cable route; average filters; grounding |
| House V missing | U2 0x40; board 12 V present |

---

## 8. Freezer / fridge (LilyGo S3 AMOLED)

### 8.1 Overview

Climate control and local UI stay on **LilyGo S3 AMOLED** — **not** Marine Board.  
IP: **192.168.10.44** · firmware `freezer.yaml`.

### 8.2 Specs

| Item | Spec |
|------|------|
| Platform | LilyGo S3 AMOLED |
| Role | Aft cockpit freezer (or as labeled) |
| UI | On-device display + HA climate |
| Network | Sisu-IoT static `.44` |

### 8.3 Installation guide

1. Mount display unit with adequate ventilation; keep away from direct salt spray.  
2. Power per LilyGo product guidance; connect temperature probe(s) as wired in `freezer.yaml`.  
3. Wi‑Fi Sisu-IoT; flash firmware; adopt in HA.  
4. Set climate targets from HA or local UI; confirm compressor/relay behaviour if external.

### 8.4 Safety recommendations

1. Do not re-purpose Marine Board pin map onto LilyGo.  
2. Keep OTA/API secrets as `!secret` only (see `secrets.md`; never commit live values).  
3. Watch for icing / blocked vents; software cannot replace airflow.

### 8.5 Safety must-dos

1. Electrical isolation before probe or power work.  
2. Verify defrost / door switch behaviour if fitted before leaving unattended.

### 8.6 Troubleshooting

| Symptom | Check |
|---------|--------|
| Display blank | Power; flash; boot mode |
| HA unavailable | Wi‑Fi `.44`; API key |
| Temp wrong | Probe placement; 1-Wire/bus wiring per YAML |

---

## 9. Spectra Newport watermaker

### 9.1 Overview

Spectra controller on LAN **192.168.0.25**. HA bridges WebSocket for status and autorun (liters or hours).  
**Not** an ESP device. Real pumps and pressures.

### 9.2 Specs

| Item | Spec |
|------|------|
| Host | `192.168.0.25:9000` WS |
| Bridge | `python_scripts/spectra_ws.py` |
| Package | `packages/spectra_newport.yaml` |
| UI | Water dashboard + optional iframe |
| Defaults | 400 L or tank shortfall; hours for dirty-water window |

### 9.3 Installation guide

1. Confirm Spectra on Sisu LAN and reachable from HA Green.  
2. Deploy spectra script + package; restart HA if needed.  
3. Open Water dashboard: live status, feed/filter/quality when running.  
4. Commission autorun only with sea strainer clean, seacock open, and product path correct.  
5. Prefer **hours** when entering silt/river within a known window; **liters** for fill.

### 9.4 Safety recommendations

1. Treat START/AUTORUN as live machinery.  
2. Expect freshwater flush after start/stop cycles.  
3. Auto-stop at 95 % needs calibrated tank sensors (levels board).

### 9.5 Safety must-dos

1. Never run dry or with closed seacock.  
2. Cancel runaway FWF/start from HA **or** Spectra UI if behaviour is wrong.  
3. Do not leave unattended autorun until soak-tested.

### 9.6 Troubleshooting

| Symptom | Check |
|---------|--------|
| Bridge offline | Ping `.25`; WS port 9000 |
| Stuck on FWF | Cancel flush; retry autorun; device quirk |
| Wrong liters | Unit select liters vs hours; tank sensors |

---

## 10. Lab simulator (retired)

The T8 dual-alt plant sim (`bench_alts_sim.yaml`) and HIL test rig (`test_rig.yaml`) are **removed**. Commission on the real Marine Board in **shadow** (§6.4). Optional connectivity-only T8: `bench_t8s3.yaml`.

---

## 11. Victron BMS NG & electrical plant (system)

### 11.1 Overview

BMS NG is **pack charge authority**. Marine Board is **alternator field regulator**. Defaults and hard ceilings must stay aligned (`ALTERNATOR_LIMITS.md`).

### 11.2 Installation recommendations

1. Commission BMS NG first (cell V, charge V, temp limits, ATC).  
2. Set Marine Board float/abs/current defaults from the same policy.  
3. Wire charge-allow into **ENBL** (recommended) so BMS “stop charge” de-excites field.  
4. Document which contactor/path the BMS opens on fault.

### 11.3 Safety must-dos

1. Do not bypass BMS charge disconnect for “more amps.”  
2. After BMS update, re-verify board setpoints.  
3. On BMS alarm during charge: ENBL off, reduce SP, investigate before restart.

---

## 12. End-to-end commissioning order

Recommended sequence on the vessel:

1. **Network** — Sisu / Sisu-IoT routing verified.  
2. **HA Green** — online, SSH, ESPHome, `core_mosquitto` + `logins:`, Sisu dashboard default.  
3. **BMS NG** — configured and documented.  
4. **Levels board** — loops + house V (optional before alts).  
5. **Alternator boards** — sense + ENBL + field, engine-off checks, low-SP run tests.  
6. **Freezer** — climate stable.  
7. **Spectra** — bridge + supervised autorun.  
8. **F8** — SK/Grafana/Influx/Sisu Nav when ready (interim Mac, `OPS.md` §7). Sisu Nav: `http://<mac-lan-ip>:8088` (SK login). MQTT kernel stays on Green.  
9. **Sea trial log** — dual-alt, heat, BMS events, V drop Port/Stbd/Saloon.

---

## 13. Quick connector cheat-sheet (Marine Board)

| Task | Connect |
|------|---------|
| Power board | CN1 GND / +12 V |
| Alternator field | CN2 +12 V / PWM1 |
| Shunt sense | U4 SH+ / SH− (Kelvin) |
| ENBL / RPM / Temp | U13 |
| Tank loop 1 / 2 | U5 / U6 |
| CAN | U7 |
| Program | USB-C J1 |

---

## 14. Document maintenance

When changing install practice or hardware:

1. Update **this file**.  
2. If limits change → `docs/ALTERNATOR_LIMITS.md` + firmware + safety docs.  
3. If network changes → `NETWORK.md`.  
4. Software gaps → **GitHub Issues** only (concrete **Touches** field; see `CLAUDE.md`).

---

## Revision history

| Ver | Date | Notes |
|-----|------|-------|
| 1.0 | 2026-07-27 | Initial full install manual: Marine Board, alts, levels, freezer, Spectra, lab, BMS, network summary |
| 1.1 | 2026-08-15 | MQTT kernel on HA Green (`core_mosquitto` + `logins:`); F8 is SK/Grafana/Influx only (#51). Bring-up: `./scripts/ha-kernel-mqtt.sh`. |
| 1.2 | 2026-08-15 | Dual-alt shared house-current budget (#16): `house_i_budget` / 50-50 split while peer online; §6.3.6 item 4. Float default pointer corrected to 13.5 V. |
| 1.3 | 2026-08-15 | Dual-alt budget default **300 A** combined / **150 A** per side (#62). |
| 1.4 | 2026-08-16 | §6.4 pointer to `ALTERNATOR_TUNING.md` (step-response / gain tune; keep cascade). |
| 1.5 | 2026-08-16 | §6.4 shadow commission (sense-only vs eMax); retired lab sim/HIL; removed `test_mode`. |
| 1.6 | 2026-09-07 | Sisu Nav Phase 1 live URL `:8088` (chart + AIS + windex, #76). |
