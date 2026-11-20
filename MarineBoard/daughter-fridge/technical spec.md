# Fridge daughter board: technical spec and plan

**Board:** Sisu fridge daughter board, for a Marine Board v1.91
**Fridge:** National Luna Weekender, Danfoss BD35F compressor, Danfoss 101N0500 electronic unit
**Version:** 0.2. Schematic draft 0.1 generated, not reviewed.
**Date:** 2026-11-15
**Issue:** #229
**Status:** owner decisions in section 12. Waiting for the owner to review the schematic draft and take measurements M1 to M4.

This board is the "later hardware" that [`Freezer-Replacement-Plan.md`](../Documentation/Freezer-Replacement-Plan.md) leaves open. That plan runs the compressor at full speed or stops it, with the Marine Board relay. This board adds the other speeds, reads the Danfoss fault lamp output, and adds a hardware watchdog. A dead ESP32 still leaves the compressor running at 3,500 rpm. That rule does not change.

The parent board is described in [`Technical Specs.md`](../Technical%20Specs.md). Where this file and the parent schematic disagree, the schematic wins.

---

## 1. The fridge

From the nameplate ([photo](../Documentation/Freezer/Freezer%20Model.jpeg)):

| | |
|---|---|
| Maker, model | National Luna, Weekender, South Africa |
| Refrigerant | R134a, 50 g |
| Compressor | Danfoss BD35F |
| Climate class | T |
| DC | 12 V, 2.5 A at -18 °C |
| AC | 230 V, 0.40 A |
| Tested to | IEC 60335-1, 60335-2-24, 61000-3-2, 61000-3-3 |

From the module ([photo](../Documentation/Freezer/Freezer%20Controller.jpeg)) and the Danfoss instruction DEHC.EI.100.G5.02:

- The label reads Danfoss 101N0500, 12/24 V DC and 100 to 240 V AC. Terminals from top to bottom are L, N, then -, +, then F, A, C, D, C, P, T. There are two C terminals.
- Every wire lands on its own insulated spade receptacle. There is no single multi-way plug on the module. The thin wires on C, D, C, P and T run to the green National Luna board at the left of the photo. That board is the one that failed.
- The pink and black pair leaving + and F is the condenser fan.
- Mains is live in the same compartment on L and N.
- The condenser coil and the compressor shell are rusty. That compartment is wet and salty, and the original control board lived in it. The daughter board does not go there. It goes in the sealed Marine Board box.

What the instruction says, as far as this board cares:

| Terminal | Function | Figures |
|---|---|---|
| C, T | Thermostat. Closed runs the compressor. The resistance in the loop sets the speed | 0 Ω 2,000 rpm 5 mA. 277 Ω 2,500 rpm 4 mA. 692 Ω 3,000 rpm 3 mA. 1,523 Ω 3,500 rpm 2 mA |
| C, P | Battery protection resistor | Open: 10.4 V out, 11.7 V in. 0 Ω: 9.6 / 10.9 V. 8.2 kΩ: 10.4 / 11.7 V. 82 kΩ: 11.3 / 12.5 V |
| +, D | Fault LED, 10 mA. Drawn as a bare LED with no resistor | 1 to 5 flashes of a quarter second, repeating every 4 seconds |
| +, F | Fan, regulated 12 V, 0.5 A average | Stays on the module |
| A, C | Lamp, regulated 12 V, 5 W | Stays on the module |
| +, - | Battery, 15 A fuse, wired straight to the battery | Stays on the module |
| L, N | Mains, 4 A fuse in L. AC wins when both supplies are present. After AC drops, the unit waits 1 minute before it runs on DC | Stays on the module |

Two things in that table matter for the design.

The three battery levels on the Weekender panel, Low, Med and High, are the 0 Ω, 8.2 kΩ and 82 kΩ rows of the Danfoss table. The numbers match the freezer plan's level table to the tenth of a volt. The National Luna board was switching resistors between C and P.

The lamp runs between A and C, so C carries real current. It is the module's working common, most likely battery minus. Nothing on this board assumes that. Every switch in the loop is isolated.

---

## 2. What the Marine Board already does

| Marine Board I/O | Fridge use today (firmware #221) | With the daughter board |
|---|---|---|
| Relay U12, GPIO7 | C-T loop on the NC contact through 1,523 Ω. Coil off runs, coil on stops | Out of the loop by default. See section 6.2 |
| TMP1 on U13 pin 3, GPIO15 | Cabinet DS18B20, the control probe | Same |
| U2 INA226 through U4 | Battery voltage, with SH+ and SH- on the 12 V feed | Same. A shunt is an option, section 6.8 |
| ENBL opto on U13 pin 1, GPIO8 | Planned for the Danfoss D flashes | Not used. It cannot do that job, section 3 |
| Buzzer GPIO2, RGB LED GPIO1 | Local state | Same |
| Wi-Fi, ESP-NOW | HA and the LilyGo display | Same |
| CN4, GPIO 9 to 14 and 18 | Unused | The daughter board |
| CN3 Qwiic, CAN, LVL1, LVL2, PWM1, RPM | Unused | Unused |

---

## 3. What is missing

I exported the netlist from `MarineBoard.kicad_sch` with `kicad-cli` on 2026-11-15 and read the nets. The part numbers below are from that netlist.

| # | Gap | Evidence | What it costs |
|---|---|---|---|
| G1 | No speed selection | One SPDT relay has two states, full speed and stop. Q4 cannot switch the loop, as the freezer plan explains | No eco speed, no Turbo |
| G2 | The fault LED cannot be wired | U14 pin 2, the ENBL opto LED cathode, is on board GND. Only the anode side reaches U13 through R22. The Danfoss LED has to sit between + and D with both ends free | The freezer plan's wiring row for D cannot be built |
| G3 | Fault input polarity | U14 is an emitter follower. Pin 4 is on +3.3 V, pin 3 drives GPIO8 through R23, and R26 pulls it to GND. GPIO8 is high when the LED is lit. `freezer_marineboard.yaml` reads it as active low with a pull-up | The flash counter would count the wrong edge |
| G4 | The relay is a power relay on a signal circuit | Relay1 is an SRD-12VDC-SL-C, 10 A contacts. The loop carries 2 to 5 mA. Songle gives no minimum load. Omron lists 100 mA at 5 V DC as the reference minimum for its G5LE, the same class of relay | A contact film on the NC contact opens the loop and the compressor does not run. The firmware cannot tell |
| G5 | No watchdog outside the ESP32 | A reset or a dead ESP releases GPIO7 and the compressor runs. A hung ESP that still drives GPIO7 high keeps it stopped | The cabinet warms and only the ESP's own watchdog can save it |
| G6 | One probe input and no probe supply | U13 carries the TMP1 signal only. 3.3 V and ground are on U9, straight off the logic rail with no current limit | One probe. A shorted probe cable drags the ESP's rail down |
| G7 | Loose parts in the wiring | The 1,523 Ω resistor and the C-P link are inline parts in the loom today | Hand-built joints in the wettest part of the boat |

Not gaps, so not on the daughter board:

- Battery voltage. U2 already measures it.
- Compressor current. U2 and U4 can do it with an external shunt, section 6.8.
- The fan, the lamp and the compressor supply. They stay on the module.
- Anything at mains voltage.
- A display. The LilyGo is the display.

---

## 4. Connector to the Marine Board

Use CN4. One cable carries everything this board needs.

| Marine Board connector | What it offers | Verdict |
|---|---|---|
| CN4, JST GH 10-pin, vertical, top side | 3.3 V, 5 V, GND and seven GPIOs: 9, 10, 11, 12, 13, 14, 18 | Chosen. Seven signals are exactly what this board needs, and the pins go high impedance when the ESP resets, which is the fail-safe |
| CN3, Qwiic, JST SH 4-pin | I²C on GPIO40/41, shared with the three INA226s | Not used. An I²C expander keeps its outputs after an ESP crash. That is the wrong fail-safe unless a watchdog gates it, and then it needs a CN4 pin anyway. CN3 stays free for a Qwiic sensor |
| U9 screw terminal | 3.3 V, 5 V, GND | Not needed. CN4 carries the power |
| U12, U13 | Relay contacts, ENBL, RPM, TMP1 | U13 TMP1 keeps the control probe. U12 is optional, section 6.2 |

CN4 has no protection of any kind, and the parent spec says to keep it on a short cable inside the same enclosure. This board follows that. The cable is a JST GH 10-pin to 10-pin, wired 1:1, 150 mm or shorter. The daughter board carries the same family of connector. Both footprints are already in the shared library: `CONN-SMD_BM10B-GHS-TBT-LF-SN`, vertical, and `CONN-SMD_SM10B-GHS-TB`, right angle.

Check pin 1 to pin 1 with a meter before the first power-up. GH cables come in both pin orders. A reversed cable puts 5 V on the 3.3 V net and ties a GPIO to ground.

### CN4 pin use

| CN4 pin | Marine Board net | GPIO | Daughter board net | Direction | Use |
|---|---|---|---|---|---|
| 1 | `+3.3V` | | `+3.3V` | power | All logic on this board, under 30 mA |
| 2 | `GND` | | `GND` | | |
| 3 | `SCK/GPIO12` | 12 | `SPD_2500_N` | out, open drain, low is on | K2 |
| 4 | `MOSI/GPIO11` | 11 | `SPD_2000_N` | out, open drain, low is on | K1 |
| 5 | `MISO/GPIO13` | 13 | `SPD_3000_N` | out, open drain, low is on | K3 |
| 6 | `CS0/GPIO10` | 10 | `STOP_N` | out, open drain, low is stop | K4 |
| 7 | `DC/GPIO9` | 9 | `OW2` | both | Second 1-Wire bus. GPIO9 is also ADC1_CH8 |
| 8 | `RST/GPIO14` | 14 | `FAULT_N` | in, low while the Danfoss LED is lit | Fault flashes |
| 9 | `BL/GPIO18` | 18 | `HEARTBEAT` | out | Watchdog trigger |
| 10 | `+5V_VCC` | | not connected | | |

All seven GPIOs are used. Anything more needs CN3.

---

## 5. Block diagram

```
 Marine Board CN4                      DAUGHTER BOARD                              Danfoss 101N0500
 ───────────────        logic side              ║   isolation gap 1.5 mm   ║        loop side
                                                ║                          ║
 +3.3V, GND ──────────► decoupling              ║                          ║
                                                ║                          ║
 HEARTBEAT (GPIO18) ──► U2 retriggerable ──► WDOG_OK                       ║
                        monostable, ~2 s     (LED supply for K1..K4)       ║
                                                │                          ║
 SPD_2000_N (GPIO11) ◄── 470 Ω ◄── K1 LED ◄─────┤     K1 ══ across R1+R2+R3
 SPD_2500_N (GPIO12) ◄── 470 Ω ◄── K2 LED ◄─────┤     K2 ══ across R2+R3
 SPD_3000_N (GPIO13) ◄── 470 Ω ◄── K3 LED ◄─────┤     K3 ══ across R3
 STOP_N     (GPIO10) ◄── 470 Ω ◄── K4 LED ◄─────┘     K4 ══ in series, closed with no power
                                                ║
                                                ║   C ── R1 280 ── R2 412 ── R3 825 ── K4 ── JP1 / RLY ── T
                                                ║   C ── R4 (0 Ω) ── P
                                                ║
 FAULT_N (GPIO14) ◄── U1 PC817 transistor       ║   U1 LED:  + ── R16 1 kΩ ── LED ── D
                      10 kΩ pull-up to +3.3V    ║
                                                ║
 OW2 (GPIO9) ◄─► 120 Ω, 4.7 kΩ pull-up, ESD ──► PROBE A, PROBE B   (3V3 through a PTC, DQ, GND)
```

---

## 6. What the board needs

### 6.1 Speed ladder

Three resistors in series make the 1,523 Ω that the freezer plan uses for full speed. Three normally open MOSFET relays tap that chain.

| Part | Value | Why |
|---|---|---|
| R1 | 280 Ω 1 % | Danfoss 277 Ω, 2,500 rpm |
| R2 | 412 Ω 1 % | 280 + 412 = 692 Ω, 3,000 rpm |
| R3 | 825 Ω 1 % | 692 + 825 = 1,517 Ω, 3,500 rpm. Danfoss says 1,523 |
| K1 | normally open | Shorts R1 + R2 + R3. 0 Ω, 2,000 rpm |
| K2 | normally open | Shorts R2 + R3. 280 Ω, 2,500 rpm |
| K3 | normally open | Shorts R3. 692 Ω, 3,000 rpm |

One relay on gives one speed. If two are on, the lower speed wins. No combination opens the loop or does anything else unexpected.

The relays are solid state, with a MOSFET output that conducts both ways, so the polarity of the loop does not matter. Their on resistance is up to 16 Ω each for the candidate parts. At the 2,000 rpm setting K1 and K4 are both in the path, which moves the speed by under 60 rpm.

### 6.2 Stop switch

K4 is a normally closed MOSFET relay in series with the ladder. With no LED current it conducts and the compressor runs. LED current opens it and the compressor stops.

This puts the stop switch on a part made for milliamp signals, which closes gap G4. It also puts the stop under the watchdog, which closes gap G5.

The loop then passes through JP1, a solder jumper that ships closed, with a two-pin terminal RLY across it. That gives three ways to build the fridge:

| Build | JP1 | RLY terminal | Stop element |
|---|---|---|---|
| Daughter board only. Recommended | Closed | Empty | K4 |
| Relay as a second stop | Cut | To U12 NC and U12 COM | K4 and the relay, either one stops |
| Relay only, as in #221 | Cut | To U12 NC and U12 COM | Relay. K4 left undriven, so it stays closed |

The third row is also the safe way to fit the board before any firmware changes. With firmware #221 the CN4 pins are never driven, K4 stays closed, K1 to K3 stay open, and the relay sees 1,517 Ω on its NC contact. That is the circuit #221 already expects.

Opening the RLY terminal by hand opens the loop. That is the service way to stop the compressor when the ESP is dead.

### 6.3 Watchdog

U2 is a retriggerable monostable. Each rising edge on `HEARTBEAT` restarts a timer of about 2 seconds. While the timer runs, the output `WDOG_OK` is high. `WDOG_OK` is the supply for the four relay LEDs.

No heartbeat means no LED supply. K1 to K3 open, K4 closes, and the compressor runs at 3,500 rpm. The ESP cannot hold the compressor stopped, or at a low speed, unless it keeps proving that its control loop is running.

The firmware must toggle `HEARTBEAT` from the same code that makes the run decision, every 0.5 seconds. It must not come from a hardware PWM channel. A PWM channel keeps toggling after the firmware has hung.

Side effects to accept:

- During an OTA update the control loop pauses, the heartbeat stops, and the compressor runs until the new firmware is up. The same happens in ESPHome safe mode and during boot.
- Firmware #221 already starts the compressor on every boot, so this is not new. The 101N0500 has its own restart protection.

The ESP32-S3 datasheet lists power-up glitches of about 60 µs on these pins. A MOSFET relay needs LED current for far longer than that to switch, and the LED supply is off until the first heartbeat.

### 6.4 Fault LED input

U1 is a PC817, the same part as on the Marine Board. Its LED goes where Danfoss draws the fault LED, between + and D, with both ends on the loop side of the board.

- R16, 1 kΩ in a 1206 case, is the first part after the + terminal. The + wire is a tap on a circuit fused at 15 A. With R16 at the terminal, a fault on this board can draw 15 mA from it and no more.
- The tap wire still needs its own 1 A inline fuse at the module end.
- A reverse diode sits across the LED.
- The transistor pulls `FAULT_N` to GND, with a 10 kΩ pull-up to 3.3 V. Lit means low. That is the polarity `freezer_marineboard.yaml` already assumes, so the firmware change is the pin number.

The module is built to drive a bare LED at 10 mA. How it limits that current is not documented. If the limit behaves like a 1 kΩ resistor, R16 leaves the opto about 4 mA at 9.6 V, and the PC817C needs well under 1 mA to pull a 10 kΩ load down. Measurement M4 in section 11 settles the value. R16 can drop to 470 Ω if the current is short.

### 6.5 Battery protection resistor

R4 sits between C and P. Fit 0 Ω and the module's own floor is 9.6 V out, 10.9 V in, which is what the freezer plan asks for. The firmware still enforces Med and High while it is alive.

The footprint is there because the level the module enforces is the only one that holds with a dead ESP. 8.2 kΩ makes that floor Med and 82 kΩ makes it High. That is decision 5 in section 12.

### 6.6 Probes

The control probe stays on TMP1, on the Marine Board. This board adds a second 1-Wire bus on GPIO9 with two three-pin terminals, PROBE A and PROBE B.

- Each terminal is 3.3 V, DQ, GND.
- The 3.3 V to the probes goes through a resettable fuse, so a shorted probe cable cannot pull the ESP's rail down.
- DQ has the same protection as TMP1 on the parent board, 120 Ω in series and an ESD diode, with a 4.7 kΩ pull-up.

Suggested use: one probe on the evaporator plate and one in the compressor compartment. A second cabinet probe would let the firmware keep cooling when the first one fails, instead of stopping.

### 6.7 Terminals

| Terminal | Pins | Goes to |
|---|---|---|
| DANFOSS | +, D, C, P, T | The module. Five thin wires. The + wire is fused at 1 A at the module end |
| RLY | 2 | Empty, or U12 NC and COM |
| PROBE A, PROBE B | 3V3, DQ, GND each | DS18B20 probes |
| CN4 link | JST GH 10-pin | Marine Board CN4 |

Screw terminals are the DB125 3.5 mm parts the Marine Board uses. The two-pin and three-pin footprints are in the shared library and the blocks interlock, so 2 + 3 makes the five-pin row.

At the module end the wires need insulated spade receptacles. The existing loom may be reusable. Measure the tab width first, M7.

### 6.8 Optional, and not on this board

A 20 A / 75 mV shunt in the Danfoss + cable, wired to U4, lets U2 measure compressor current as well as voltage. It needs no hardware on the daughter board. The firmware scale changes from `shunt_resistance: 0.0001875` to `0.00375`. Full scale is then about 22 A, above the 15 A fuse. With current, the firmware can tell a compressor that is running from one that was only told to run.

### 6.9 Protection and isolation

- The loop side is `DANFOSS_PLUS`, `DANFOSS_D`, `DANFOSS_C`, `DANFOSS_P`, `DANFOSS_T` and the `LOOP_*` nets between the resistors. The logic side is everything on CN4.
- Only K1 to K4 and U1 cross between them.
- `daughter-fridge.kicad_dru` holds the rule: 1.5 mm from any loop net to anything else. No ground pour under the loop side.
- This is functional isolation. Both sides end up on the same 12 V battery. The gap keeps the module's common away from the Marine Board ground.
- A bidirectional TVS across C and T protects the relay outputs. Its voltage is chosen after measurement M1.
- Conformal coat the finished board, with the connectors masked.

### 6.10 Candidate parts

Ratings marked "confirm" are from memory of the datasheet. Check them when the part is imported with `lcsc_import.py`.

| Ref | Part | In shared library | Notes |
|---|---|---|---|
| K1, K2, K3 | Normally open MOSFET relay, 60 V, 100 mA or more, SOP-4. Littelfuse CPC1017N, or Toshiba TLP172GM, or Panasonic AQY212 | No | Confirm on resistance and LED turn-on current |
| K4 | Normally closed MOSFET relay, 60 V, 100 mA or more, SOP-4. Littelfuse CPC1117N, or a Panasonic AQY412 or Omron G3VM form B part | No | Confirm it is closed with no LED current |
| U1 | PC817C-S | Yes | Symbol and SOP-4 footprint |
| U2 | 74LVC1G123 retriggerable monostable | No | Timing resistor and capacitor set about 2 s |
| R1, R2, R3 | 280 Ω, 412 Ω, 825 Ω, 1 %, 0805 | No | E96 values |
| R4 | 0 Ω 0805 | No | Or 8.2 kΩ, 82 kΩ |
| R16 | 1 kΩ 1206 | No | 0.25 W |
| LED resistors | 470 Ω 0805, four | No | About 4 mA per relay LED |
| Diode | 1N4148W | Yes | Across the U1 LED |
| ESD | ESD5Z3.3T1G | Yes | On `OW2` |
| TVS | Bidirectional, value after M1 | SMCJ33CA is there | A smaller case would do |
| Fuse | Resettable, about 100 mA hold | No | Probe supply |
| J1 | BM10B-GHS-TBT or SM10B-GHS-TB | Footprints yes | Vertical or right angle, set by the mounting |
| Terminals | DB125-3.5-2P, DB125-3.5-3P | Yes | |
| Test pads | GND, +3.3V, WDOG_OK, both ends of the loop | Yes | For the bench test in phase 4 |

About 40 parts, all 0805 or larger except the ESD diode. Hand assembly is realistic.

---

## 7. What happens when things fail

| Condition | Loop | Compressor |
|---|---|---|
| CN4 cable unplugged, or the daughter board has no power | K4 closed, 1,517 Ω | 3,500 rpm |
| Marine Board 5 V or 3.3 V rail dead. This is how the v1.00 prototype failed | K4 closed, 1,517 Ω | 3,500 rpm |
| ESP in reset, booting, in safe mode, or in an OTA update | No heartbeat, K4 closed, 1,517 Ω | 3,500 rpm |
| Firmware hung with its outputs still driven | Heartbeat stops, LED supply drops within about 2 s, 1,517 Ω | 3,500 rpm |
| Firmware alive, probe missing | Firmware opens K4, as the freezer plan requires | Stopped |
| K4 fails shorted | Closed | Runs and cannot be stopped. The firmware can see the cabinet fall below the setpoint while it commands stop. It should alarm on that |
| K1, K2 or K3 fails shorted | Lower resistance | Stuck at a lower speed. Still cools |
| K1, K2 or K3 fails open | Higher resistance | Faster than asked |
| C or T wire broken, or RLY opened | Open | Stopped. The firmware can see the cabinet warm while it commands run. It should alarm on that too |
| D or + wire broken | | No fault codes. Control is unaffected |

To run the fridge by hand with a dead Marine Board, do nothing. It is already running at full speed. To stop it, open the RLY terminal or pull the T wire.

---

## 8. Mechanical

Nothing here is fixed until the fit check in phase 2.

What the current box allows, from the constants in [`make_enclosure.py`](../enclosure/make_enclosure.py):

| Item | Value |
|---|---|
| Gutters around the Marine Board | 20 mm east, west and south. 14 mm north, the antenna side |
| Inside height | 38 mm. Board top is 13.6 mm above the floor |
| Lid ribs | 5 mm deep, at thirds in both directions |
| Panel connectors | Hole centres 17.2 mm above the inside floor, Ø12.4, with bodies that reach into the gutter |
| CN4 | 53.2 mm from the west edge of the board, 36.8 mm from the north edge. 29.8 mm from the east edge |

A second board does not fit above the Marine Board. The relay and the fuses leave too little height, and a board over the north end would sit on top of the antenna. The Spectra plan reached the same conclusion for its daughter board.

Two ways to mount this one:

| | A. Fridge box with an east bay | B. Standard box, east gutter |
|---|---|---|
| Board | About 30 × 67.5 mm, on four M3 bosses | A strip about 18 × 75 mm, low parts only |
| Box | New print. `RIGHT` in `make_enclosure.py` grows from 20 to roughly 55 to 65 mm, so the box grows from 129.4 to roughly 165 to 175 mm long | The existing print |
| Panel connectors | Right for a fridge: one 5-pin for the Danfoss loom, 3-pin probe connectors with a supply pin, correct legends | Reuse the CAN and LVL holes. Legends are wrong |
| Mounting | Printed bosses | Adhesive standoffs. The floor has no bosses there |
| Layout | Easy | Tight. The connector bodies sit 11 mm above the floor |

I recommend A. The fridge needs different panel connectors and legends anyway, and the legends are cut into the wall, so a correct fridge box is a new print either way. The skeleton `daughter-fridge.kicad_pcb` carries the 30.0 × 67.5 mm outline of option A as a proposal and nothing else.

PCB: 2 layers, 1.6 mm FR4, 1 oz copper, ENIG, parts on the top side. Same fab house and the same Board Setup minimums as the Marine Board. This board has no via-in-pad, so plain vias.

---

## 9. Firmware changes

These belong to a later issue. Listed here so the hardware and the firmware agree on pins.

| Change in `freezer_marineboard.yaml` | Detail |
|---|---|
| Stop output | From GPIO7 to GPIO10, open drain, low is stop. GPIO7 stays low unless the relay is wired as a second stop |
| Speed | Three open drain outputs on GPIO11, 12, 13. One on at a time. The Weekender rule from the freezer plan can come back: 2,000 rpm below 12.6 V, 3,500 rpm above 13.2 V, Turbo forces 3,500 |
| Heartbeat | GPIO18, toggled every 0.5 s from the control script. Not a PWM output |
| Fault input | From GPIO8 to GPIO14. Still active low |
| Probes | A second `one_wire` bus on GPIO9 |
| Current, if the shunt is fitted | `shunt_resistance: 0.00375` |

New entities, the LilyGo screen, the HA dashboard and the feature map pair follow the usual rules in `CLAUDE.md` when that issue is done.

---

## 10. Tools

**KiCad 10 for the schematic and the PCB.** It is what the Marine Board uses. The daughter board gets the same libraries, the same PCBWay rules and the same checks.

**None of the ArtCraft apps is an EDA tool.** I went through the names and descriptions of all 82 public repositories under github.com/storytold on 2026-11-15, and read the CADCraft README. None does schematic capture, netlists, footprints, design rule checks or Gerber output. Several are still useful around the edges.

| Job | Tool | Why |
|---|---|---|
| Schematic of record | KiCad 10 Schematic Editor, `daughter-fridge.kicad_sch` | ERC, the shared symbol library, and `fab_package.py` checks the board against it |
| First draft of the schematic | A Python script that writes the `.kicad_sch` from the net table in this spec | Text in, checks out. See below |
| New parts | [`lcsc_import.py`](../lcsc_import.py) into `../Lib` | The existing flow. One library for both boards |
| PCB of record | KiCad 10 PCB Editor, `daughter-fridge.kicad_pcb` | |
| Footprints and nets onto the board | Update PCB from Schematic, F8, in the PCB Editor | `kicad-cli` has no command for this |
| Placement | By hand, or scripted with KiCad's bundled `pcbnew` Python | About 40 parts |
| Routing | By hand, or Quilter as on the Marine Board | Two layers and about 25 nets |
| Checks | `kicad-cli sch erc` and `kicad-cli pcb drc --schematic-parity` | The same gates as the Marine Board |
| Review pictures | `kicad-cli sch export pdf`, `kicad-cli pcb render` | So the reviewer sees the drawing, not the file |
| Fab package | [`fab_package.py`](../fab_package.py), changed to take a project path | Today it hard-codes the Marine Board files and four copper layers |
| Box and fit check | FreeCAD, [`make_enclosure.py`](../enclosure/make_enclosure.py) and `fit_board.py` | The box is already a parametric script |
| Looking at STEP files | SolidCraft. `solidcraft-cli snapshot` renders a STEP with a section cut | Optional. Handy for the fit check |
| Dimensioned mounting drawing, DXF | CADCraft | Optional. It is 2D drafting, DXF and DWG |
| Silkscreen art and panel legends | VectorCraft | The logo footprint already exists in the library |
| BOM and order sheets | GridCraft opens the `.xlsx` that `fab_package.py` writes | |
| Datasheets | PdfCraft | |

### How the schematic gets drawn

KiCad 10's IPC API needs the GUI running and has no schematic editing commands, so the first draft is written as text. The procedure is the [draft-schematic](../kicad-skills/draft-schematic/SKILL.md) skill:

1. Sections 4 to 6 are written out as a net table, [`draft_nets.py`](draft_nets.py): every part, every pin, every net.
2. [`draft_sch.py`](../kicad-skills/scripts/draft_sch.py) places each symbol and joins its pins with net labels, then runs ERC, compares the exported netlist with the table pin by pin, and writes [`docs/daughter-fridge-schematic.pdf`](docs/daughter-fridge-schematic.pdf).
3. The owner opens it in the Schematic Editor, replaces labels with wires where that reads better, and reviews it.
4. `draft_nets.py` is deleted in the same commit as the first hand edit. From then on the `.kicad_sch` is the source. The script refuses to overwrite a sheet it did not write.

Draft 0.1 uses KiCad's bundled symbols for the parts that are not in `LCSC` yet: `Relay_SolidState:CPC1017N` / `CPC1117N`, `74xGxx:74LVC1G123`, `Isolator:PC817`. Swap them for imported parts with LCSC numbers before ordering.

Points to check when reviewing draft 0.1:

- **Watchdog timing.** R20 470 kΩ and C20 4.7 µF are a first guess at about 2 s. Confirm the 74LVC1G123 timing formula and its allowed external R and C range from the datasheet.
- **Q drive.** U2 Q supplies all four relay LEDs. In normal use at most two are lit at once, about 9 mA. Confirm that against the 74LVC1G123 output current at 3.3 V.
- **Unused footprints.** The PCB has no footprints yet. Run Update PCB from Schematic (F8) once the sheet is approved.

If the owner would sooner draw it by hand from the net table, that works too. I then check the exported netlist against the table.

Code-first tools such as SKiDL, atopile and tscircuit were considered. They produce a netlist or their own board files, not a schematic the owner can read and edit in KiCad, and the parity check in `fab_package.py` needs a real `.kicad_sch`.

### What was checked on this machine

- KiCad 10.0.1 is installed. `kicad-cli sch` has `erc`, `export` and `upgrade`. `kicad-cli pcb` has `drc`, `export`, `import`, `render` and `upgrade`.
- The bundled Python imports `pcbnew` 10.0.1. It wrote the skeleton board in this folder. KiCad's documentation calls these bindings deprecated, so do not build a long-lived tool on them.
- `kipy`, the IPC API client, is not installed.
- CADCraft 0.20.1 and SolidCraft 0.42.0 are installed. SolidCraft ships `solidcraft-cli`.
- The skeleton project passes `kicad-cli sch erc` and `kicad-cli pcb drc --schematic-parity` with 0 violations.

---

## 11. Phases

| Phase | Work | Who | Done when |
|---|---|---|---|
| 0 | Approve this spec. Answer section 12. Take measurements M1 to M8 | Owner, at the fridge | Decisions and numbers written into this file |
| 1 | Import parts. Generate the schematic. ERC clean, netlist matches the table, PDF exported | Agent, owner reviews | Owner signs off the schematic PDF |
| 2 | Box option, outline, placement, routing. DRC clean with parity. STEP export and fit check | Agent and owner | `fit_board.py` reports clearance on every side |
| 3 | `fab_package.py` takes a project path. Order boards and parts | Agent, owner orders | Gerbers, BOM and positions in `production/` |
| 4 | Bench test on a Marine Board with no fridge | Owner | Every row of section 7 measured with a meter across C and T |
| 5 | Firmware, LilyGo, HA, feature map | Agent | `verify.sh` green, reviewer APPROVED |
| 6 | Fit to the fridge. Update the freezer plan, `INSTALLATION.md` and the READMEs | Owner | A week of normal use with fault codes and all four speeds exercised |

Measurements for phase 0, with the module powered and the old board unplugged:

| # | Measure | Why |
|---|---|---|
| M1 | Open-circuit voltage from T to C, and its polarity | Sets the TVS and confirms 60 V relays are ample |
| M2 | Current with T shorted to C through a meter | Should be 5 mA |
| M3 | Voltage from C to battery minus | Shows whether C is ground |
| M4 | With the old board's D wire unplugged, so nothing is connected between + and D: the voltage from + to D. Then, during a fault flash, a meter on mA from + to D | Sets R16 |

Dropped by the owner on 2026-11-15: M5 (the Danfoss speed table is assumed), M6 (the probe is the standard DS18B20), M7 (owner handles the tab connections), M8 (the box goes inside the fridge, owner handles wire length).

---

## 12. Decisions

Decided by the owner, 2026-11-15:

1. **Stop switch:** K4 on this board. JP1 ships closed. The RLY terminal stays as a service break.
2. **Speeds:** all four. K1 to K3 fitted.
3. **Box:** option A, a fridge variant with a wider east bay. The box mounts inside the fridge, so it sits in cold, damp air: check for condensation and Wi-Fi reach through the cabinet at fit-out.
4. **Probes:** standard DS18B20 1-Wire, as on the Marine Board. The factory probe is not reused.

Still open:
5. **Battery floor with a dead ESP.** R4 is 0 Ω for Low, as the freezer plan says. 8.2 kΩ gives Med and 82 kΩ gives High.
6. **Watchdog timeout.** About 2 seconds, and the compressor runs during OTA updates.
7. **Shunt.** Add a 20 A / 75 mV shunt on U4 for compressor current, or leave it.
8. **Assembly.** PCBWay assembles, or hand solder. About 40 parts.

Not planned: a simple backup thermostat on this board that takes over when the ESP is dead, so the fridge holds a temperature instead of running flat out. It would change the dead-ESP rule in the freezer plan. Say so if you want it looked at.

---

## 13. Files in this folder

| File | What |
|---|---|
| `technical spec.md` | This file |
| [`README.md`](README.md) | Short index and the check commands |
| `daughter-fridge.kicad_pro` | Project. Board Setup minimums copied from the Marine Board. Net classes `LOOP_30V_0A1` and `RAIL_3V3_0A5` |
| `daughter-fridge.kicad_sch` | Schematic, draft 0.1, generated from `draft_nets.py`. Not reviewed |
| `draft_nets.py` | Net table for the draft. Deleted at the first hand edit |
| `docs/daughter-fridge-schematic.pdf` | PDF of the draft |
| `daughter-fridge.kicad_pcb` | Two-layer board with the proposed outline and nothing else |
| `daughter-fridge.kicad_dru` | The isolation rule and the PCBWay rules |
| `sym-lib-table`, `fp-lib-table` | Point at `../Lib`, so both boards share one library |

## 14. Sources

- Danfoss, Instructions, Electronic Unit for BD35/BD50F Compressors, 101N0500, DEHC.EI.100.G5.02 / 520N0232, 01-2010. Copy at [jacksonsleisure.com](https://www.jacksonsleisure.com/content/pdf/dometic/Danfoss%20Diagnostics.pdf)
- [KiCad IPC API, for add-on developers](https://dev-docs.kicad.org/en/apis-and-binding/ipc-api/for-addon-developers/)
- [KiCad PCB Python bindings](https://dev-docs.kicad.org/en/apis-and-binding/pcbnew/)
- [ArtCraft on GitHub](https://github.com/storytold), [CADCraft](https://github.com/storytold/cadcraft)
- Marine Board: `MarineBoard.kicad_sch`, [`Technical Specs.md`](../Technical%20Specs.md), [`Freezer-Replacement-Plan.md`](../Documentation/Freezer-Replacement-Plan.md), [`Spectra-Replacement-Plan.md`](../Documentation/Spectra-Replacement-Plan.md)

## Revision history

| Ver | Date | Notes |
|---|---|---|
| 0.1 | 2026-11-15 | First plan (#229). Project skeleton created. No circuit drawn |
| 0.2 | 2026-11-15 | Owner decisions in section 12. M5 to M8 dropped. Schematic draft 0.1 generated from `draft_nets.py`: ERC clean, 97 pins on 29 nets match the table. Fault resistor RD is now R16 and battery resistor RP is R4 (references need a number) |
