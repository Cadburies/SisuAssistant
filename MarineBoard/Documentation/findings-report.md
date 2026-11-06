# Findings report

24 October 2026. Current schematic `MarineBoard/MarineBoard.kicad_sch`, netlist exported that day with Eeschema 10.0.1. Checked against `MarineBoard/Documentation/Design-Rules/MarineBoard-Rules.md`, using the two power sheets and the parts those rails actually feed.

These currents are sums from datasheets and from the nets. They are not a measurement of a built board. Rule 3.5 still wants that measurement. Nothing here is a layout review, and nothing here is the retired v1.00 board.

## How the current gets to each rail

Battery positive lands on `+12V BAT`. A series SS56, D14, then F1, a 2 A ATM blade, feed `VIN_FUSED`. The SMBJ18A sits there. L2, 22 µH, and a bead take that node to `VIN_BUCK` and the TPS5430.

The TPS5430 makes `5V_BUCK`. The feedback divider hangs on that node, before the bead and before F2. F2 is a 1 A ATM blade. After F2, D4, an SS14, joins `+5V_VCC`.

USB VBUS joins the same `+5V_VCC` through its own SS14, D1. USB does not reach the TPS5430 input, and it does not back-feed `5V_BUCK`. With both sources present, the higher diode carries the merged rail.

The SY8089 hangs on `+5V_VCC` and makes `+3.3V`. A bead, L7, feeds only the module pin `ESP_3V3`. The CAN transceiver, the three INA226 devices, the buzzer, the red LED, CN3, CN4 pin 1, and U9 pin 1 are on `+3.3V` directly.

`+12V`, after bead L4, is inside F1. It feeds the relay coil, the MCP1407, the two 4-20 mA connectors, and two INA226 VBUS pins. CN2 takes `+12V BAT` and returns through F3, 10 A, and the field MOSFET. The relay contacts are a separate conductor, fused by F4, 10 A.

## What each part draws

The ESP32-S3-WROOM-2 figures are from the module datasheet v1.7, at 3.3 V and 25 °C. Transmit at 802.11b, 1 Mbps, is 355 mA at 100% duty. Receive, HT20, is 95 mA. Modem-sleep with the CPU idle at 240 MHz is 47.6 mA with peripheral clocks on, and 32.9 mA with them off. Those rows do not include a separate flash or PSRAM term for the N32R16V. The supply still has to be able to deliver at least 0.5 A. That 0.5 A is a capability, not the current this sheet draws.

Three INA226 devices, active, are 330 µA typical and 420 µA maximum each. Together that is 0.99 mA typical and 1.26 mA maximum. U18 pin 8 and U19 pin 8 sit on `+12V`. The VBUS pin impedance in the electrical table is 830 kΩ, so each of those pins takes about 15 µA at 12 V. The battery shunt current does not pass through the board. U2 measures it through R7, 10 Ω.

U11 is an SN65HVD230 with pin 8 tied to ground, so it is in high-speed mode for as long as 3.3 V is up. The no-load supply current used here is 10 mA typical and 17 mA maximum. A terminated bus adds driver current on top of that no-load row. Standby, a few hundred microamps, is not this circuit.

D16, the red LED, has no switch. Anode on `+3.3V`, cathode through R33, 470 Ω, to ground. With a red forward drop of 2.0 V the current is 2.8 mA. At 1.8 V it is 3.2 mA, and at 2.2 V it is 2.3 mA. The 2.0 V drop is an assumption.

The 3.3 V divider is R4, 100 kΩ, over R8, 22 kΩ. The setpoint is 3.327 V, and the current is 27 µA. With the SY8089 reference at its 591 mV to 609 mV window and 1% resistors, the output stays between about 3.22 V and 3.43 V. That is inside the module's 3.0 V to 3.6 V.

The status LED is a WS2812B-2020-V6, one device, powered from `+5V_VCC` through D21, a 1N4148W. The V6 sheet allows 3.3 V to 5.3 V on VDD, so the diode drop still leaves a legal voltage. Each channel is 12 mA, and white is 36 mA. Quiescent is at or below 1 µA. Firmware `sys_rgb` restores off, so an idle board is the quiescent figure, and a full-white lamp is 36 mA on the 5 V rail.

The buzzer is the KLJ-4020. The schematic text says 2 V to 4 V, 100 mA, 4 kHz. GPIO2 drives it through a transistor at 4000 Hz in `marine_board_base.yaml`. Silent current is about zero. While it sounds, use 100 mA from `+3.3V`. That 100 mA is the part's stated current, not a measurement on this board.

The relay is an SRD-12VDC-SL-C sensitive coil, published as 0.36 W, 400 Ω, 30 mA at 12 V. At 14.4 V and a still-cold 400 Ω the current is 36 mA. A hot coil is a bit less. The coil is on `+12V`, switched to ground by Q2. Contact current is F4's problem, not the coil's.

When the relay GPIO is high, U17's LED takes about 2.1 mA from 3.3 V through R30, 1 kΩ, using a 1.2 V LED drop. The collector then pulls Q2's base through R41, 1 kΩ, from `+12V`. The resistor would allow about 11 mA. A PC817C will not deliver that from a 2 mA LED, so the fuse sum allows 5 mA for base drive. That 5 mA is an allowance, not a measured collector current.

U16's collector is on `+12V BAT`, ahead of F1, and R32, 10 kΩ, returns to ground. When that opto is on the current is about 1.2 mA from the battery net. The field path is GPIO38, R29 1 kΩ, U16, the MCP1407, and Q4. `marine_alternator.yaml` sets `alt_field_out` to 4000 Hz. Average LED current follows the duty. It does not move F1.

U14's output, into R26 10 kΩ, is about 0.33 mA from 3.3 V when the opto is on. U21 into R48, 47 kΩ, is about 70 µA. Their LEDs are not powered from 3.3 V. The 74LVC1G14's quiescent current is well under 0.1 mA. Pull-ups of 10 kΩ draw 0.33 mA only while the line is low, so they are left out of the idle sum.

The MCP1407, Microchip DS20002019 at 25 °C, draws 130 µA typical and 250 µA maximum with the input high, and 35 µA typical and 100 µA maximum with the input low. Q4 is a BUK762R4-60E. Typical total gate charge is 158 nC at a gate-source voltage of 10 V. At 4000 Hz the average gate current is 0.63 mA. The driver rail is near 12 V, so the real charge is a bit higher than the 10 V number. When the pin is held low, as shadow mode does, that 0.63 mA drops out and only the driver quiescent current remains.

Each 4-20 mA loop, U5 and U6, draws 4 mA to 20 mA from `+12V` when a sensor is fitted, and about zero when the loop is open. Two loops are 8 mA to 40 mA. The 3.9 Ω sense resistors do not set that current.

## Converter current

Both efficiencies are taken as 85%. That is a floor, not a point read off a curve. A higher efficiency lowers every input current below. A bench measurement replaces it.

SY8089 input current is the 3.3 V current times 3.3 / 5 / 0.85, which is the 3.3 V current times 0.776.

TPS5430 input current, while it is actually regulating a real load, is 5 V times the 5 V current, divided by 0.85 times the voltage at U3. Do not add the TPS5430's 2 mA typical quiescent current on top of that. The 2 mA typical, 4.4 mA maximum, non-switching figure is the right scale only when the 5 V load has collapsed to the divider. The SY8089's 50 µA typical quiescent current is the same kind of term.

The SS56 drop at a few hundred milliamps is not the 0.55 V maximum, which is specified at 5 A. Call it a few tenths of a volt. The table below is the voltage at the TPS5430 pin. A few tenths of diode drop raises the 12 V column by a few percent.

The 5 V divider, R10 10 kΩ over R12 3.24 kΩ, sits on `5V_BUCK` and draws 0.38 mA at the 4.99 V setpoint. F2 does not carry it. USB does not power it, because D4 blocks VBUS from `5V_BUCK`.

## Four cases

External connectors are empty in every row. "Idle" is modem-sleep with clocks on, CAN enabled, D16 on, buzzer silent, status LED off, relay off, field held off, loops open. "Receive" swaps in the 95 mA receive row. "Transmit" uses 355 mA plus the high side of the small always-on parts. "Stacked" adds the buzzer, both opto LEDs held on, a full-white status LED, the relay coil, the 5 mA base-drive allowance, both loops at 20 mA, and the gate charge at 4 kHz.

| Case | 3.3 V | Into the SY8089 | Through F2, buck sourcing | Into the TPS5430 at 12 V | Through F1 at 12 V |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle | 61 mA | 48 mA | 48 mA | 24 mA | 24 mA |
| Receive | 109 mA | 84 mA | 84 mA | 42 mA | 42 mA |
| Transmit | 376 mA | 292 mA | 292 mA | 144 mA | 144 mA |
| Stacked | 481 mA | 373 mA | 409 mA | 201 mA | 277 mA |

F2 on the stacked row includes the 36 mA white LED. The idle, receive, and transmit rows leave that LED off. F1 on the first three rows is only the buck, because the coil, the loops, and the driver load are off. On the stacked row the extras at 12 V are 30 mA of coil, 40 mA of loops, 5 mA of base drive, and about 1 mA of driver quiescent plus gate charge.

The same stacked 5 V load at other voltages on the TPS5430 pin:

| Voltage at U3 | Buck input | Coil, if still 400 Ω | F1, stacked |
| --- | ---: | ---: | ---: |
| 11 V | 219 mA | 28 mA | 293 mA |
| 12 V | 201 mA | 30 mA | 277 mA |
| 13.8 V | 175 mA | 35 mA | 255 mA |
| 14.4 V | 167 mA | 36 mA | 249 mA |

F1 is a 2 A fuse. The heaviest on-board case in this table is under 0.3 A. The spare is headroom, not a load the sheet is asking for.

F2 is a 1 A fuse. The stacked on-board case is 0.41 A. The OR diode is an SS14, 1 A average. On-board current leaves both of them with margin. The margin is where a backlight on CN4 pin 10, or a load on U9 pin 2, has to fit.

If the 3.3 V rail is loaded to the 0.5 A capability figure, and the white LED is also on, the SY8089 input is 0.39 A and F2 carries about 0.42 A. Reflected to 12 V at the TPS5430, with the coil and the loops as well, F1 is still about 0.28 A.

If someone loads the SY8089 toward its 2 A rating, the input current at 85% is 1.55 A. That is past the SS14 and past F2. The 2 A number in the technical spec is the IC's ceiling. This diode-OR cannot feed it. The heaviest 3.3 V load this chain can take from one SS14, with the whole 1 A going into the SY8089 and none of it stolen by a 5 V external load, is about 1.3 A at the 85% floor. The module path through L7 is a separate limit. The schematic describes that bead as 1.5 A, and the transmit peak on it is 355 mA.

USB alone, with no 12 V, cannot run the coil, the loops, or the gate driver. D1 then carries the SY8089 input plus the status LED plus whatever is on CN4 pin 10 and U9 pin 2. The stacked logic load on D1 is the same 0.41 A. F2 carries none of it.

Below the TPS5430 UVLO, 5.3 V typical and 5.5 V maximum at the pin, the buck stops. Without USB, 5 V and 3.3 V collapse. The rules accept that during cranking.

If USB is the higher of the two 5 V sources, D1 carries the merged rail and the TPS5430 is left with the 0.38 mA divider. The efficiency formula is the wrong tool at that load. Expect a few milliamps into the TPS5430, on the scale of its 2 mA typical quiescent current.

## Current that is not in the table

CN4 pin 1, CN3 pin 2, and U9 pin 1 are 3.3 V outlets. CN4 pin 10 and U9 pin 2 are 5 V outlets. No display is part of the base board. A small backlight is often tens of milliamps, and a larger one is not. Those pins count against F2 and against the SS14 that is sourcing `+5V_VCC`, and the 3.3 V pins count against the SY8089 input as well.

CN2 can pass up to F3's 10 A from `+12V BAT`. The technical spec calls the practical continuous current about 10 A, limited by the copper. That current does not enter the TPS5430 and does not pass through F1.

Relay contact current, up to F4's 10 A, is not coil current.

The net-class ampere numbers are fuse and source limits. `+12V BAT` and ground are classed at F3 plus F1, 12 A. That is not a draw.

## Recommendations

### USB inrush

Rules 2.4 and 3.11. Capacitance connected directly to VBUS is at most 10 µF in parallel with 44 Ω. More capacitance has to sit behind a part that limits the inrush. A series Schottky does not.

On VBUS itself the sheet has C1, 10 µF, and C7, 0.1 µF. That is already 10.1 µF, and there is no 44 Ω part. C8, 22 µF, and C5, 0.1 µF, sit on `+5V_VCC`. The moment D1 conducts, those two join VBUS, and the total is about 32 µF. C20, the 220 µF polymer, is behind D4 and stays off VBUS. Leave it there.

C1's DC-bias loss, on the order of three quarters of its capacitance at 5 V for that Samsung part, happens after the edge. The empty capacitor is what the connector has to charge.

Keep 10 µF or less on the VBUS side of D1. Move C8 off that path, or put a load switch or other inrush limiter between VBUS and the 22 µF. Do not look for a 44 Ω footprint to bolt on. The sheet has no place where that resistor would make 32 µF legal.

### No system ESD clamp on VBUS

Rules 5.8 and 6.1. A connector a person can touch, including VBUS, is an IEC 61000-4-2 design. D+ and D− already have an H5VL10B and then 33 Ω. The shield already goes to ground. VBUS has the Schottky and the capacitors, and no clamp.

Add an IEC 61000-4-2 rated TVS from VBUS to ground at the receptacle. Its clamped voltage has to stay under the SY8089 absolute maximum of 6.0 V, because D1 will pass a strike on VBUS onto `+5V_VCC` once it conducts. The same clamp has to leave a normal 5.25 V USB host, and the TPS5430's high tolerance after its own diode, inside the SY8089's 5.5 V operating limit. The buck side does not need this TVS for regulation. D1 is already what stops the buck driving VBUS.

### The 22 µF ceramics

Rules 3.2 and 3.9. CIN and COUT are supposed to be X5R or better and still greater than 10 µF after DC bias. C4, on 3.3 V, and C8, on 5 V, are both Murata GRM158R61A226ME15D, 22 µF, 10 V, X5R, 0402. The sheet marks that part limited, for mobile devices, and the operating range is −55 °C to 85 °C. The reference data has a temperature curve at no bias. It does not have a DC-bias curve for this part number, so the "greater than 10 µF" line cannot be closed. The box ambient in the technical spec is −40 °C to 65 °C, which this temperature range covers. The open item is the bias capacitance and the mobile-only grade, not the 85 °C ceiling.

Replace C4 and C8 with a larger-case X5R or X7R, general or industrial grade, whose own bias curve still shows more than 10 µF at the DC voltage on that pin. C4 only has to survive 3.3 V. C8 has to survive 5 V. Do not fit another 0402 22 µF and call it derated.

### The 3.3 V inductor

Rule 3.9. The app note wants DCR under 30 mΩ where the efficiency curves are the goal, and about 40% ripple at maximum load, with saturation current above the peak.

L1 is a Murata DFE252012F-1R0M=P2. The table gives 1.0 µH, DCR 40 mΩ maximum and 33 mΩ typical, saturation current 4.7 A with 5.3 A beside it, and temperature-rise current 3.3 A with 3.9 A beside it. At 5 V in, 3.3 V out, 1 µH, and 1.5 MHz, the ripple is 0.75 A. At the part's 2 A rating that is about 37% of the load, and the peak is about 2.4 A, under both current columns. At a 0.5 A rail the same ripple is larger than the load and the peak is about 0.9 A. The ripple target is a maximum-load target, and this inductor meets it. It is lightly loaded in real use, which is a different regime, not a failed 40% check.

The DCR is the miss. Ten extra milliohms at 0.5 A is 2.5 mW. That will not warm a fuse. It does mean the app-note efficiency curves are not this circuit.

Either fit a 1.0 µH whose DCR is under 30 mΩ and whose saturation current is above about 2.4 A, or keep this inductor and write down that the published curves do not apply. Do not change it for current rating.

### The 3.3 V compensation parts

Rule 3.9. The 3.3 V row in the app-note table is 100 kΩ over 22.1 kΩ, with 22 pF across the upper resistor. The sheet has 100 kΩ over 22 kΩ, and C6 is 6.8 pF.

The DC setpoint is already inside 3.0 V to 3.6 V, as calculated above. This miss is the transient network, not the voltage limit.

Change R8 to 22.1 kΩ and C6 to 22 pF so the network matches the table, or keep 22 kΩ and 6.8 pF and record a load-step measurement before calling the loop done.

### The inlet clamp is a 12 V part

Rule 2.3. Standoff has to sit above the highest normal inlet, including charge voltage. At the pulse current the inlet can really deliver, the clamp voltage has to stay under the absolute maximum of the first silicon. Sustained overvoltage needs a disconnect or a shutdown. A TVS held in breakdown on DC is a heater. Load-dump energy is not closed until the alternator's pulse is compared with the TVS, using Us, Ri, and duration from ISO 16750-2. A 600 W, 10/1000 µs rating is not that comparison.

D6 is an SMBJ18A. The Born Semiconductor table for that row is 18 V standoff, breakdown 20.0 V to 22.1 V, and 29.2 V clamp at 20.6 A, in a 600 W package. There is no series impedance drawn between the inlet and the TVS. Clamp voltage during that telecom-style pulse is inside the TPS5430's 36 V operating range and inside the LMBR340's 40 V. That part of the check passes for a 12 V boat, where 18 V standoff is above a 14.4 V charge voltage.

It does not pass on a 24 V boat. An 18 V standoff on a 24 V source sits in breakdown. The rules describe a class of board that may be fed from 12 V or from 24 V. This TVS is a 12 V inlet part. Do not fit it on a 24 V inlet.

Add a sustained-overvoltage disconnect, or a shutdown of the buck, above the normal charge voltage. Do not close the load-dump line until the alternator actually fitted is compared with this package. If the purchased reel is Littelfuse, file that PDF beside `datasheets/Born-Semiconductor-SMBJ.pdf`. The two documents are not the same citation even when the electrical class matches.

### Write down what F1 protects

Rule 2.2. The board fuse is sized to the copper it protects, and the reason for a fuse, a PTC, or an electronic fuse is written on the schematic. The vessel feeder is a different device. This file does not set that feeder.

F1, 2 A, is in series with the logic path only: the TPS5430, and from there the relay coil, the gate driver, and the loop feed. The on-board sum above is under 0.3 A, so 2 A is a trace fuse, not a load fuse. `+12V BAT` also reaches CN1, CN2, the freewheel diode, U16, and C42 without passing through F1. CN2 is fused by F3. The relay contacts are fused by F4.

On the schematic, next to F1, state that it protects the logic, buck, and loop feed, and that CN2 and the relay contacts are other conductors with their own fuses. If the intent was one fuse for everything that leaves the battery lug, this sheet does not do that, and the copper would have to be redrawn. The vessel-feeder rating and distance stay in section 9 of the rules. The Eaton opening curve was not in the saved datasheet set, so opening-time coordination is still open.

### Test points on the enable pins

Rule 6.6. Test points go on the rails, on ground, and on EN, before placement.

The sheet has TP1 on ground, TP2 on `+12V`, TP3 on `+5V_VCC`, TP4 on `+3.3V`, TP5 on the gate node, and TP6 on VSENSE. U3 ENA and U1 EN have none. Add those two. The module EN network is on the ESP32 sheet, not on these two, so it is outside this recommendation.

## What already matches

Two bucks, in the right order. USB diode-ORed onto the rail between them, and not wired into the TPS5430 input. No PD controller. Rd of 5.1 kΩ on both CC pins. USB-C receptacle, SBU left open, shield to ground. TPS5430 ENA left floating, boot capacitor 10 nF, divider 10 kΩ over 3.24 kΩ. The 5 V setpoint is 4.99 V typical. At the top of the reference window and 1% resistors it reaches about 5.17 V, and after the OR diode that still has to be checked against the SY8089's 5.5 V operating limit at light load, where the Schottky drop is smallest.

C20 is a Panasonic 10SVPE220M, 220 µF, ESR 20 mΩ maximum, under the worked example's 40 mΩ ceiling. The catch diode is an LMBR340, 3 A, 40 V, and it is not one of the OR diodes. Reverse polarity is the series SS56. SY8089 EN is pulled to its own VIN by R3, not to 12 V. D+ and D− have the H5VL10B and then 33 Ω.

The rail test points listed above are present. The 3.3 V DC setpoint is inside 3.0 V to 3.6 V even with the 22 kΩ lower resistor.

## Still open

Layout of either switcher. Quiescent current of a built board, in each state rule 3.5 names. Load-dump energy against ISO 16750-2 for the alternator actually fitted. Minimum ESR of the 10SVPE220M, and the ripple-current rating at 500 kHz, which is the edge of the published bin. DC bias remaining on C13, C15, C16, and C17. Which SMBJ reel is purchased. Current on U9, CN3, and CN4, which this report leaves at zero. The module EN delay, which is not drawn on these two sheets.

The SS14 forward drop at the currents in the table was not taken from a saved curve. The TPS5430 input currents use the voltage at U3 and leave that drop as a few percent.
