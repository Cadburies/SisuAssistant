# Design rules for a marine DC control board

Date: 2026-10-23.

These rules are for a control board that takes 12 V or 24 V DC from a vessel electrical system, sits where an alternator can throw a load dump at it, and has connectors a person can touch. They describe that class of board. They do not describe one schematic, one PCB spin, or one bill of materials.

The controller for this class of board is the Espressif ESP32-S3-WROOM-2. MCU numbers below come from **ESP32-S3-WROOM-2 Datasheet v1.7**, the file `MarineBoard/Documentation/esp32-s3-wroom-2_datasheet_en.pdf`. Where that datasheet excerpts the ESP32-S3 Series Datasheet, the section number cited here is the module datasheet's section. Use the series datasheet only for a pin-function name the module sheet points at. Limits in this file are the module's limits.

Each rule has three parts. The rule is what to do. The reason is why it is true. The source is the document that carries the number or the requirement. Physics and datasheet limits always apply. A market-access rule (an FCC modular grant, CE, UL, the EU common-charger directive) applies when a product is placed on that market.

The notes in this folder are a prompt. They are not a source. This file does not cite them.

## 1. What this class of board is

The inlet is vessel DC, 12 V or 24 V nominal. The PCB does not carry mains.

The board lives next to an alternator and a battery. The inlet sees reverse connection, cranking sag, short switching spikes, and load dump. Those are different events and they get different parts.

People touch connectors. A connector a person can touch gets a system ESD discharge, IEC 61000-4-2. The module's factory ESD rating is a different test.

The radio, if the controller is this module, is the module's own PCB antenna. Wi-Fi and Bluetooth LE share that one antenna. The design does not add a second antenna, a discrete matching network, or a second radio.

A lithium cell on the board, and an alternator charging a house bank, are different circuits. Section 5 keeps them apart.

## 2. Energy at the inlet

### 2.1 Reverse polarity is an electrical function

**Rule.** Stop a reversed source with a circuit rated for the inlet current. A series Schottky is acceptable when its forward drop, at the real current and temperature, still leaves the downstream converters inside their input range. A high-side P-channel MOSFET, gate held off by a resistor to the source and pulled on by a resistor to ground, has a lower drop. An ideal-diode controller does the same job and also blocks current flowing back out of a hold-up capacitor. A keyed connector is a convenience. It is not the protection.

**Why.** A reversed battery destroys electrolytic capacitors, the catch diode of a buck, and any IC whose absolute maximum pin voltage is a diode drop below ground. The connector can be forced, or a cable can be built the wrong way.

**Source.** Texas Instruments SLVA139, *Reverse Current/Battery Protection Circuits* (Jeff Falin, June 2003), for the series diode, the high-side P-MOSFET, and the low-side N-MOSFET. The MOSFET's body diode and an already-enhanced channel both pass current from a charged output capacitor back to the inlet. An ideal-diode controller is the part that measures that direction.

### 2.2 The board fuse and the vessel fuse are different devices

**Rule.** Give the board its own overcurrent device, sized to the board's wiring and to the copper it protects, and coordinated with the fuse at the battery. Choose among a one-time fuse, a polymeric PTC, and an electronic fuse for a reason written on the schematic: a fuse opens and stays open, a PTC recovers when it cools, an electronic fuse can retry and can report the fault. The vessel feeder fuse is specified by the boat wiring standard. This file does not set that rating or that distance.

**Why.** A fuse on the board protects the board's trace and its own wiring. The fuse at the battery protects the run from the battery to the board. One device cannot sit in both places.

**Source.** ABYC E-11 and ISO 10133 for the vessel DC installation. The board device comes from its own datasheet (opening time, hold current, trip current, voltage).

### 2.3 A TVS clamps a pulse. It does not regulate a DC overvoltage

**Rule.** Set the TVS standoff voltage above the highest normal inlet voltage, including charging voltage and ripple. At the pulse current the inlet can actually deliver, the TVS clamp voltage must remain below the absolute maximum of the first silicon downstream. Then compare that TVS's pulse-power curve with the load-dump pulse for the alternator in use. A rating at 8/20 µs or 10/1000 µs is not a load-dump rating until that comparison is done, with the pulse width and the source impedance taken from the standard. Sustained overvoltage, a charger stuck high or a 24 V battery on a 12 V input, needs a circuit that disconnects or shuts down. A TVS that stays in breakdown on DC becomes a heater.

**Why.** Load dump lasts on the order of hundreds of milliseconds. A small SMB package can survive a short telecom pulse and fail on a load dump of the same peak voltage, because the energy is the integral of power over time. Inventing that energy without the standard's Us, Ri, and duration is a guess.

**Source.** ISO 7637-2 for the short switching transients. Since the 2011 edition, cranking and load dump are in ISO 16750-2 (Test A is an unsuppressed alternator, Test B is an alternator with central suppression). Use the row for the system voltage and for the suppression that is actually fitted. Do not copy a Us out of a blog.

### 2.4 Inrush is the capacitor on the input, not the average load

**Rule.** Budget the peak, not the average. Input capacitors charge through the wiring resistance and the reverse-polarity device the moment the connector mates. A regulator soft-start limits the load the regulator draws after it has started. It does not limit the capacitor hung directly on its input. Sequence each enable from that regulator's datasheet, and hold the module's EN low until its 3.3 V rail has been inside the module's recommended range for the time in section 5.3.

If the board is also a USB device, the capacitance connected directly to VBUS is limited to 10 µF in parallel with 44 Ω. Any larger capacitor sits behind a load switch or other soft-start.

**Why.** The spark and the voltage dip happen at the uncharged capacitor. Average current says nothing about that edge.

**Source.** USB 2.0 Specification, section 7.2.4.1, for the VBUS inrush limit. Regulator sequencing from the regulator datasheet. Module timing from ESP32-S3-WROOM-2 Datasheet v1.7, section 4.5 and Table 4-6: the 3.3 V rails stabilize for at least 50 µs before EN rises, and EN stays below VIL_nRST for at least 50 µs to reset the chip.

### 2.5 Mains stays off this PCB

**Rule.** The inlet is vessel DC. Power for a bench session comes from a listed external supply. Creepage and clearance for mains are a different product.

**Why.** Mains on the same PCB as a touched connector and a radio module pulls the board into a hazardous-voltage standard and into a construction this class of board does not need.

**Source.** IEC 62368-1 for audio, video, and ICT equipment that does carry hazardous voltage. IEC 60664-1 for the creepage and clearance that would then apply.

## 3. Conversion

### 3.1 Copy the switcher from its datasheet, including the layout

**Rule.** Use the recommended input range, the absolute maximum on VIN, on the enable pin, and on the switch node, and the output capacitor the compensation example was built with. Place the input ceramic as the datasheet draws it: smallest loop from VIN to the IC ground, ground via the thermal pad, switch node only as long as the inductor and the catch diode or the synchronous FET require, feedback taken on the quiet side of the output capacitor. A second-stage buck follows its own datasheet the same way. A shielded inductor is the default. Read Isat and Irms from that inductor's datasheet at the peak current and at the temperature, and read which inductance drop that vendor uses for Isat.

**Why.** The switch loop is the EMI source and the voltage-spike source. A layout invented from a typical application, with the capacitor moved to "fit", fails the datasheet's own condition. An unshielded drum inductor couples that loop into the radio. An inductor chosen on average current saturates on the peak and the switch current runs away.

**Source.** The regulator datasheet's electrical table, compensation section, and layout section. Emissions limits, when a product is placed on a market that has them, are CISPR 32 and FCC Part 15 Subpart B. Those standards do not replace the regulator layout.

### 3.2 Read the ceramic's DC bias curve

**Rule.** For every ceramic used as a bulk capacitor, read the capacitance versus DC bias curve for that part number, that voltage, that dielectric, and that case size. Derate to the capacitance that remains at the real DC voltage. X7R and X5R are the dielectrics for a supply bypass. Do not let a contract manufacturer substitute a smaller case or a higher dielectric constant.

**Why.** A high-K ceramic loses a large fraction of its capacitance at a DC bias well below its voltage rating. The loss depends on the part. A single factor applied to every "10 µF" capacitor is fiction.

**Source.** The capacitor manufacturer's bias data (Murata, Samsung, TDK, and their equivalents) for the exact part.

### 3.3 Electrolytic life is the manufacturer's equation

**Rule.** If an electrolytic is required, take life from that series' endurance equation (hours, core temperature, ripple current). Polymer or ceramic replaces it where the regulator's stability section allows the ESR. A regulator whose reference design uses a polymer output capacitor is not automatically stable with a small ceramic.

**Why.** Electrolyte dries. Hours at rated temperature are the part's life, and they fall as the core runs hotter. An unknown brand has no equation to evaluate.

**Source.** The series datasheet from a manufacturer that publishes one (Panasonic, Nichicon, Chemi-Con, and their equivalents).

### 3.4 An LDO is for a small drop or a small current

**Rule.** Dissipation is (Vin − Vout) × I, at the peak current, with the package's thermal resistance and the copper the datasheet assumes. Dropout is the headroom in that datasheet at that current and temperature. The module rail is 3.0 V to 3.6 V (section 5.1). A stage that drops a 12 V or 24 V inlet down to 3.3 V at the module's transmit current belongs in a switcher. An LDO after the switcher is reasonable when the drop and the current make a small number of watts, or a fraction of a watt.

**Why.** The module's published 802.11b transmit peak is 355 mA (Table 6-4, 100% duty, 3.3 V, 25 °C). Dropping 12 V to 3.3 V at that current is (12 − 3.3) × 0.355 ≈ 3.1 W in the pass element, before any other load. That is a heater.

**Source.** The LDO datasheet for dropout, Iq, and θJA. ESP32-S3-WROOM-2 Datasheet v1.7, Table 6-2 and Table 6-4, for the rail and the current.

### 3.5 Quiescent current is measured on the built board

**Rule.** Measure the current of the assembled board in each state it actually sits in: running, radio on, radio off, asleep, and held in reset. The module tables are the floor for the module alone, at 3.3 V and 25 °C, with the peripherals the table names. Add the LDO Iq, the divider currents, the LED currents, and the pull-ups. A few milliamps is a small term on a house bank. The same few milliamps empties a coin cell. If a coin cell is on the board, size it from that cell's datasheet, including pulse capability.

**Why.** A datasheet Iq for one IC misses the rest of the board. The module's own floor already depends on the mode.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, Tables 6-4, 6-5, and 6-6. Active transmit peaks are 355 mA (802.11b, 1 Mbps, 20.5 dBm), 297 mA (802.11g, 54 Mbps), 286 mA (802.11n HT20 MCS7), and 285 mA (HT40 MCS7). Receive is 95 mA (HT20) and 97 mA (HT40). Modem-sleep with the CPU idle at 240 MHz is 32.9 mA with peripheral clocks off and 47.6 mA with them on. Light-sleep is typically 240 µA with the GPIOs high-Z, plus the in-package PSRAM (the sheet's example is 140 µA for 8 MB octal PSRAM at 3.3 V). Deep-sleep is 7 µA to 8 µA for RTC memory, higher with the ULP running. EN held low is typically 1 µA. Those are module figures. The board measurement is the one that counts.

### 3.6 Two bucks, and USB as a second source of the rail between them

**Rule.** The vessel inlet feeds a wide-input buck that makes 5 V. A USB-C receptacle is a second source of that same 5 V, joined through a diode-OR, not a wire. A second buck takes the merged 5 V down to the module's 3.3 V. USB does not connect to the first buck's input. The parts named for this chain in the production BOM are a TI TPS5430DDA, a Silergy SY8089A1AAC, and an HCTL HC-TYPE-C-16P-01A USB 2.0 Type-C receptacle. Sections 3.7 to 3.11 are what those datasheets require. They are the checks. A later pass compares the schematic and the PCB to them.

**Why.** The TPS5430 stops below about 5.5 V, so it cannot run from USB VBUS. The module wants 3.0 V to 3.6 V, which is the SY8089's job. A wire between the two 5 V sources lets the buck drive VBUS, or lets VBUS drive the buck's switch node.

**Source.** Production BOM `MarineBoard/production/MarineBoard-BOM.csv`, lines for U3, U1, and J1. TPS5430 UVLO in section 3.7. Module rail in section 5.1.

### 3.7 TPS5430: inlet buck

**Rule.** Treat the copy in hand as SLVS632K, revised January 2024. For the TPS5430, not the TPS5431:

- VIN operating range is 5.5 V to 36 V. Absolute maximum is −0.3 V to 40 V. PH in steady state is −0.6 V to 40 V, and a transient under 10 ns may reach −1.2 V. The datasheet warns that a VIN near its absolute maximum can push PH past PH's own absolute maximum. The inlet clamp keeps VIN inside the operating range.
- Undervoltage lockout rises at 5.3 V typical, 5.5 V maximum, with about 0.35 V of hysteresis. Below that the part does not switch. A cranking sag that takes the inlet through this threshold shuts the 5 V buck off. USB is the only other source of that rail, and it is not there when the engine is cranking.
- ENA floats to run. An internal pull-up does that. The part stops when ENA is below 0.5 V. The rising threshold is 1.3 V maximum. Absolute maximum on ENA is 7 V. Disable it with an open drain to ground. Do not tie ENA to VIN, to the inlet, or to any pull-up above 7 V.
- VSENSE absolute maximum is 3 V. Only the feedback divider connects to it. The reference is 1.221 V typical, 1.196 V to 1.245 V over −40 °C to 125 °C. The 5 V example starts from a 10 kΩ upper resistor and a 3.24 kΩ lower resistor. Output overvoltage protection trips at 112.5% of the reference.
- An external catch diode sits from PH to ground. Its reverse voltage is higher than VIN(max) + 0.5 V. Its peak current is higher than the maximum load plus half the inductor ripple. TI's 5 V, 3 A example uses a 40 V, 3 A Schottky. The conduction time in the diode is longer than the high-side on time, so the diode's current and its thermal rating are the continuous case, not a brief spike.
- BOOT is a 0.01 µF capacitor from BOOT to PH.
- The high-side current limit is 4 A minimum, 5 A typical, 6 A maximum, then hiccup for 13 ms to 20 ms. The datasheet's worked designs carry up to 3 A continuously. Inductor saturation current and the inlet fuse are set from the peak, using the datasheet's inductor equations, and the fuse still coordinates with the vessel feeder (section 2.2).
- VIN is bypassed with a low-ESR X5R or X7R ceramic placed as the layout section draws. The worked input filter uses 10 µF. The capacitor's voltage rating covers the clamped inlet after DC-bias derating (section 3.2). The PowerPAD is soldered to the ground plane that layout shows.
- Quiescent current, non-switching, is 2 mA typical and 4.4 mA maximum. Shutdown with ENA low is 15 µA typical and 50 µA maximum. Thermal shutdown is 135 °C minimum, 162 °C typical.

**Watch.** ENA is the pin people tie to VIN out of habit. On this part that exceeds a 7 V absolute maximum as soon as the inlet is a 12 V battery. The SY8089 enable pin is the opposite part (section 3.9). A 1 A Schottky is the wrong class of catch diode for a buck whose example is a 3 A diode. Confirm which diode is the catch diode, against section 7.2.1.2.7 of SLVS632K, when the schematic is reviewed. Do not use this section to decide that review in advance.

**Source.** Texas Instruments, *TPS5430, TPS5431* datasheet, SLVS632K, January 2024. Local copy: `MarineBoard/Documentation/tps5430.pdf`. Tables 5-1, 5-3, and 5-5, sections 6.3 and 7.2.1.2.

### 3.8 The TPS5430 output capacitor is part of the compensation

**Rule.** Internal compensation expects a polymer or other capacitor with a controlled ESR, in the shape of the 5 V example: 220 µF, ESR low enough that the ESR zero stays above the loop crossover, and not so low that the zero sits far above the internal poles at 24 kHz and 54 kHz. In that example the calculated ceiling is 40 mΩ, the RMS ripple in the capacitor is 143 mA, and the part TI names is a 10 V POSCAP in the 10TPB220M class. A small ceramic across the polymer is optional in that example. It is not a substitute for the polymer.

A ceramic-only output is a different circuit. SLVS632K section 7.2.3 adds an external compensation network and keeps the LC resonant frequency at or below 7 kHz. Copying the internal-compensation schematic and then deleting the polymer removes the zero the loop was built around.

The production BOM lists a Panasonic 10SVPE220M for this role. The SVPE characteristics list dated 01 Apr 2022 rates that row at 10 V, 220 µF ±20%, ESR 20 mΩ maximum at 100 kHz and 20 °C, and ripple current 2700 mA rms at 100 kHz and 105 °C. Leakage is 500 µA after 2 minutes. The sheet says the specifications change without notice and tells the reader to confirm the current delivery spec before the design is frozen. Do that before treating 20 mΩ or 2700 mA as final.

**Watch.** 20 mΩ maximum meets the example's 40 mΩ ceiling. The table publishes no minimum ESR. At 20 mΩ and 220 µF the ESR zero, 1 / (2π × ESR × C), is about 36 kHz, between the 24 kHz and 54 kHz poles. A unit with a lower ESR moves that zero up. Check the zero at the ESR the capacitor actually has. The ripple-current correction factor is 1.0 for frequencies from 100 kHz up to, and not including, 500 kHz. This buck switches at 500 kHz, on the edge of that bin. Confirm the ripple rating at 500 kHz with the current Panasonic spec. The series banner "8 mΩ maximum" is a different row, not the 10SVPE220M.

**Source.** SLVS632K section 7.2.1.2.4 and section 7.2.3. Panasonic, SVPE series characteristics list, 10SVPE220M row, 01 Apr 2022. Local copy: `MarineBoard/Documentation/Panasonic SVPE OS-CON datasheet (10SVPE220M).pdf`.

### 3.9 SY8089: the buck from the merged 5 V to 3.3 V

**Rule.** The copy in hand is Silergy AN_SY8089A1 Rev. 0.0, dated 2018, and the pages are marked confidential. Confirm a current datasheet before a respin. Until that check, the limits below are the ones this copy states.

- Operating VIN is 2.5 V to 5.5 V. Absolute maximum is −0.3 V to 6.0 V. UVLO is 2.5 V maximum, with 150 mV of hysteresis. The part has a 100% dropout mode: when VIN falls toward VOUT, the output follows the input. The module rail still has to stay at or above 3.0 V (section 5.1). Surviving UVLO is not the same thing as regulating 3.3 V.
- The merged 5 V rail, from the TPS5430 at its high tolerance and from USB VBUS at its high tolerance, measured after the OR diode, stays at or below 5.5 V. 6.0 V is the damage line, not a place to operate. USB 2.0 allows 5.25 V at a high-power host port. The TPS5430 reference alone moves about ±2% over temperature before resistor tolerance. Budget both sources.
- EN must not float. On is 1.2 V minimum. Off is 0.4 V maximum. Absolute maximum on EN and on FB is VIN + 0.6 V, so the enable pull-up goes to the SY8089 input, never to the 12 V inlet. If the pin that drives EN can be high-Z while VIN is present, the datasheet says to add 1 MΩ from EN to ground.
- CIN is an X5R or better ceramic, greater than 10 µF, the text suggesting a 6.3 V rating, placed against the IN and GND pins. COUT is X5R or better, greater than 10 µF, the text suggesting a 10 V rating. Apply section 3.2. A 6.3 V X5R at 5 V bias often no longer meets "greater than 10 µF".
- The feedback reference is 600 mV typical, 591 mV to 609 mV at the stated test. The lower divider resistor is between 10 kΩ and 200 kΩ. The table for a 3.3 V output gives 100 kΩ over 22.1 kΩ and a 22 pF feed-forward capacitor across the upper resistor. The FB trace does not run beside the switch node.
- The inductor is chosen for about 40% ripple at the maximum load, with saturation current above the peak in the datasheet's formula, and DCR under 30 mΩ where the efficiency curves are the goal. Output current is 2 A. Short-circuit hiccup starts when the output falls below half the regulated voltage. The hiccup is 190 Hz at 50% duty.
- Thermal numbers in this copy: 0.83 W dissipation at 25 °C ambient, θJA 120 °C/W, ambient operating range −40 °C to 85 °C. The module beside it is limited to 65 °C ambient (section 5.2). The tighter limit is the one the box has to meet. Quiescent current is 50 µA typical, 70 µA maximum, and shutdown is 0.1 µA typical, 1 µA maximum.

**Watch.** This enable pin is active and must be held. The TPS5430 enable pin floats to turn on, and it cannot touch a 12 V rail. The two circuits are not interchangeable. The 5.5 V operating ceiling is the tight number in the whole chain: a 5 V buck set a little high, or a USB host at 5.25 V with a Schottky that is barely conducting, both land on this pin. The 2018 application note may not match a current Silergy datasheet. Where they differ, the current datasheet wins.

**Source.** Silergy, *AN_SY8089A1*, Rev. 0.0. Local copy: `MarineBoard/Documentation/silergy_sy8089a1aac_xonjuly20_12_link-2.pdf`. Absolute maximum table, recommended operating conditions, electrical characteristics, and the application section (inductor, divider table, capacitors, layout).

### 3.10 The diode-OR

**Rule.** Each 5 V source reaches the SY8089 input through its own series diode, cathode toward the merged rail. The USB diode keeps the TPS5430 from driving VBUS. The buck diode keeps USB from driving the TPS5430 output capacitor, the catch diode, and PH. With both sources present, the higher one supplies the load and the other diode is reverse-biased. The TPS5430 keeps regulating its own output. That is the point of the diodes.

The diode that is on carries the SY8089 input current, continuously, at the ambient temperature, after the diode datasheet's derating. Input current is higher than the 3.3 V load current by VOUT / (VIN × efficiency). Rate the diode for that number at the real 3.3 V load. The SY8089's 2 A rating is the ceiling of the part, not automatically the load. The forward drop is inside the budget of section 3.9, at both ends: light load, where the drop is smallest and the voltage is highest, and full load, where the drop is largest and the SY8089 is closest to dropout.

The production BOM includes SS14 diodes rated 40 V, 1 A. A 1 A continuous rating does not cover a 2 A buck's input current at full load. It may cover a 3.3 V rail whose real load is only the module and a few small parts. The check is the arithmetic above, plus the diode's current versus temperature curve. A Schottky does not limit inrush (section 3.11).

**Watch.** Do not use the catch diode of section 3.7 as the OR diode, or the OR diode as the catch diode. They see different voltages and different duty. Identify each one when the schematic is reviewed. A keyed USB plug is not the OR.

**Source.** SLVS632K for what sits on PH. AN_SY8089A1 for the input range the merged rail has to satisfy. BOM description of the SS14: 40 V, 1 A. USB 2.0 Specification section 7.2.4.1 for why a diode is not a soft-start.

### 3.11 USB-C as a power inlet

**Rule.** A USB-C source turns VBUS on when it sees a sink termination, Rd, on CC1 and CC2. For a default USB device that resistor is 5.1 kΩ to ground on each CC pin. A USB-C to USB-C cable does not hide the resistor in the plug. Without Rd, a compliant USB-C source leaves VBUS off and the SY8089 has no USB path.

There is no USB Power Delivery controller in this chain. A compliant PD source then stays at 5 V. Do not design the SY8089 input for 9 V or 12 V. USB 2.0 high-power VBUS at the host is 4.75 V to 5.25 V. Cable drop lowers the floor. Anything that puts the merged rail above 5.5 V, after the diode, is outside the SY8089 operating range. The receptacle in the BOM is a USB 2.0 16-pin Type-C, which matches the module's full-speed PHY (section 5.8). The data pair still gets the ESD rule in section 6.1.

Capacitance connected directly to VBUS is at most 10 µF in parallel with 44 Ω. More capacitance sits behind a part that limits the inrush. A series Schottky does not do that. Once the diode conducts, the capacitors on the merged rail are on VBUS.

**Watch.** CC resistors are what make the 5 V appear. They are easy to leave off because a USB-A to USB-C cable enables VBUS by itself and hides the mistake. The inrush capacitor is the next miss: the bulk capacitor wants to sit on the 5 V rail, and the USB rule wants it on the far side of a current limit. Those two wants have to be solved on purpose. A charger that ignores the USB voltage range can exceed 6.0 V on the SY8089. The chain as specified has no second clamp on that pin unless one is added for that reason.

**Source.** USB Type-C specification, sink CC termination Rd. USB 2.0 Specification section 7.2.4.1. AN_SY8089A1 operating and absolute maximum VIN. BOM line for J1, USB 2.0 16-pin Type-C.

## 4. Two charge paths

### 4.1 An alternator is not a cell charger

**Rule.** A circuit that drives an alternator field follows the house battery's charge profile and the alternator's current, voltage, and temperature limits. Those limits come from the alternator manufacturer and from the battery manufacturer. They are not the 4.20 V constant-current / constant-voltage profile of a single lithium-ion cell.

**Why.** The house bank is a battery the alternator is charging. The control loop is regulating a machine, often at tens of amperes, into a bank whose voltage is set by that bank's chemistry. Treating it as a cell charger applies the wrong voltage and the wrong current.

**Source.** The alternator datasheet and the house-battery datasheet for the chemistry actually fitted. ISO 16750-2 still applies to the electronics hanging on that bus (section 2.3).

### 4.2 A lithium cell on the board uses that cell's datasheet

**Rule.** Apply this section only when a lithium cell is on the board. Charge with a charger IC, to the voltage and the current that cell's datasheet names, and with the thermistor the charger datasheet requires. Stop charge outside the cell's charge-temperature window. Many graphite-anode lithium-ion cells forbid charging below 0 °C. Confirm it on the cell sheet. The pack, even a single cell, has protection for overvoltage, undervoltage, overcurrent, and short circuit. A cell's end-of-discharge voltage often sits below 3.0 V, so a 3.3 V rail fed from that cell needs a buck-boost, or a load specified to run down to the cell's end voltage.

**Why.** "Lithium" is a family. A 4.20 V ceiling is right for many lithium-ion and lithium-polymer cells and wrong for LiFePO4. Charging a graphite anode below its limit plates metallic lithium. A protection PCB designed for a different series stack does not protect this cell.

**Source.** The cell manufacturer's datasheet for voltage, current, and temperature. The charger IC datasheet for the thermistor network. UN 38.3 is a transport test of the cell or pack as submitted. It is not a quality mark, and a cell report does not cover a pack built differently. IEC 62133-2 is the safety standard for portable sealed secondary lithium cells and batteries.

## 5. The controller, ESP32-S3-WROOM-2

All numbers in this section are from Datasheet v1.7 unless another document is named.

The module integrates an ESP32-S3R8V or ESP32-S3R16V, a 40 MHz crystal, octal flash, octal PSRAM, and a PCB antenna. It brings out 33 GPIOs on a 41-pin module (Table 3-1). Wi-Fi is 802.11b/g/n, 2412 to 2484 MHz. Bluetooth LE is Bluetooth 5, 2402 to 2480 MHz, transmit power from −24.0 dBm to 20.0 dBm, sharing the same antenna. Pins that exist only on the bare chip, including the octal flash and PSRAM bus, are not available. Assign functions from Table 3-1.

Datasheet v1.7 Table 1-1 marks ESP32-S3-WROOM-2-N16R8V and ESP32-S3-WROOM-2-N32R8V as EOL. A new design uses a variant the current datasheet does not mark EOL or NRND, and checks that the datasheet in hand is still the current one. v1.7 lists ESP32-S3-WROOM-2-N32R16V without that mark.

### 5.1 The 3V3 pin has no headroom above 3.6 V

**Rule.** Power the module from one rail on pin 2 (3V3). Recommended operating voltage is 3.0 V to 3.6 V, typical 3.3 V (Table 6-2). Absolute maximum is −0.3 V to 3.6 V (Table 6-1). Recommended maximum and absolute maximum are the same voltage, so the regulator must not overshoot 3.6 V, including load-release transients. The external supply must be able to deliver at least 0.5 A (Table 6-2, IVDD). That 0.5 A is the supply capability. Size it for the transmit peak in Table 6-4 plus every other load on the same rail.

**Why.** A rail that rings to 3.8 V is already past the absolute maximum. A supply sized on modem-sleep current collapses when the radio transmits.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, Tables 6-1, 6-2, and 6-4. RF tests are at 3.3 V ±5% and 25 °C unless the table says otherwise (section 7).

### 5.2 Ambient is the air outside the module

**Rule.** Keep the air immediately outside the module between −40 °C and 65 °C (Table 6-2 and Table 1-1). Enabling PSRAM ECC raises that ambient limit to 85 °C and reduces usable PSRAM by 1/16 (section 1.2). Storage of the bare module is −40 °C to 105 °C (Table 6-1). The on-chip temperature sensor reads the die, from −40 °C to 125 °C, and it moves with clock frequency and I/O load (section 5.2.2.2). Use it as a die sensor. Use a separate sensor, with its own datasheet, for ambient, battery, or heatsink temperature.

**Why.** 65 °C is a mild limit for an enclosed box near machinery. The die sensor will read high of the air and cannot stand in for a battery thermistor.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, sections 1.2 and 5.2.2.2, Tables 1-1, 6-1, and 6-2.

### 5.3 EN does not float, and it waits for the rail

**Rule.** Drive EN (pin 3). High enables the chip. Low powers it off. The datasheet says not to leave EN floating. Release reset only after the rail has been valid for tSTBL, minimum 50 µs, and hold EN below VIL_nRST for tRST, minimum 50 µs, to reset. VIH_nRST is 0.75 × VDD up to VDD + 0.3 V. VIL_nRST is −0.3 V to 0.25 × VDD (Table 6-3). The module's peripheral schematic uses an RC on EN so the rail is up before the pin rises. The usual values printed there are 10 kΩ and 1 µF, adjusted to the actual ramp.

**Why.** A floating enable follows leakage and noise, and the chip comes out of reset while its straps are still moving.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, Table 3-1 note on EN, section 4.5, Tables 4-6 and 6-3, and the peripheral-schematic note in section 9 (R = 10 kΩ, C = 1 µF).

### 5.4 Strapping pins are GPIO0, GPIO3, GPIO45, and GPIO46

**Rule.** At reset the module samples four straps (section 4, excerpted from the series boot chapter and restated for this module's EN pin).

| Pin | Internal default at reset | What it sets |
| --- | --- | --- |
| GPIO0 | Weak pull-up, bit 1 | Boot mode, with GPIO46. Bit 1 is SPI boot. |
| GPIO46 | Weak pull-down, bit 0 | Boot mode, and ROM message printing. |
| GPIO45 | Weak pull-down, bit 0 | VDD_SPI voltage selection, with the eFuse. On the R8V and R16V parts, VDD_SPI is already eFused to 1.8 V. |
| GPIO3 | Floating, no internal pull | JTAG source. The external circuit must not be high-Z if this strap is used. |

Setup time before EN rises is tSU, minimum 0 ms. Hold time after EN is high, before the pin becomes a normal GPIO, is tH, minimum 3 ms (Table 4-2). The latch keeps the sample until power-down. Add an external resistor only to force a bit the other way, or because some other circuit on that net can overpower the weak pull during those 3 ms. Weak pull-up and pull-down are typically 45 kΩ (Table 6-3). Do not hang a capacitor on a strap pin unless it has finished moving before the sample. GPIO0's pull-up cannot charge a large capacitor inside that window, and the boot mode then depends on leftover charge.

SPI boot is GPIO0 = 1 and GPIO46 = any value. Joint download boot is GPIO0 = 0 and GPIO46 = 0 (Table 4-3).

**Why.** A strap is sampled once, on a weak resistor, in a 3 ms window. A sensor, a LED, a programmer, or a capacitor that is still slewing wins that window and the module boots into the wrong mode forever after, until the next power cycle.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, section 4, Tables 4-1, 4-2, 4-3, 4-4, and 4-5, and Table 6-3 for the 45 kΩ pulls. GPIO2 on this module is a normal GPIO (pin 38, ADC1_CH1). It is not a strap. MTDI on this module is GPIO41.

### 5.5 GPIO47 and GPIO48 are 1.8 V pins

**Rule.** On the ESP32-S3R8V and ESP32-S3R16V inside this module, VDD_SPI is set to 1.8 V by eFuse. GPIO47 and GPIO48 then operate at 1.8 V (Table 3-1, note 2, and the note on Figure 9-1). Treat every other GPIO as a 3.3 V pin. Do not connect a 3.3 V driver to GPIO47 or GPIO48.

**Why.** Those two pins follow the flash and PSRAM I/O voltage. Driving them at 3.3 V exceeds the pin.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, Table 3-1 note 2, section 4.2, and Figure 9-1.

### 5.6 A GPIO does not drive a load

**Rule.** A GPIO drives a logic input, or a MOSFET gate through a gate network, or an LED whose current is set by a resistor and kept inside the pin's DC table. It does not drive a relay, a motor, a heater, a lamp, or a solenoid. Table 6-3 gives a typical source of 40 mA (VDD = 3.3 V, VOH at least 2.64 V, PAD_DRIVER = 3) and a typical sink of 28 mA (VOL = 0.495 V, same drive setting). Those are typical strengths at the strongest pad setting under those voltages. They are not a continuous budget, and the module's absolute-maximum table does not publish a sum across pins. VIH minimum is 0.75 × VDD. VIL maximum is 0.25 × VDD. VIH maximum is VDD + 0.3 V.

Hold every external MOSFET gate and every regulator enable in the off state while the GPIO is high-Z: from the moment power is applied, through reset, until firmware configures the pin. A pull-down or pull-up does that, sized so it wins against leakage and loses to a deliberate drive. 10 kΩ is a common value. It is not a value fixed by a standard. If the gate shares a net with a strap pin, the pull has to be checked against section 5.4 so it does not steal the boot sample.

**Why.** An inductive load kicks the pin past VDD + 0.3 V when it turns off, and the DC current of a coil is already past the pin. A floating gate during reset turns the load on before any firmware runs.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, Table 6-3. The coil diode is section 6.4 of this file.

### 5.7 ADC1 for measurements. ADC2 is shared with the radio

**Rule.** Put a measured analog signal on ADC1. On this module the ADC1 pins are GPIO1 through GPIO10 (ADC1_CH0 through ADC1_CH9), with GPIO3 also a strap. ADC2 is GPIO11 through GPIO20 (ADC2_CH0 through ADC2_CH9). GPIO19 and GPIO20 are also USB D− and USB D+.

On ESP32-S3, ADC2 is also used by Wi-Fi. The oneshot driver arbitrates with the Wi-Fi driver. Check the return code. `ESP_ERR_TIMEOUT` means the sample is invalid. Continuous (DMA) reads from ADC2 are not supported: the results are unstable, documented in the ESP32-S3 errata. Do not apply the older rule from the original ESP32, which was that `adc2_get_raw()` simply fails for the whole time Wi-Fi is started.

The ADC is 12-bit (section 5.2.2.1). Calibrate to millivolts with the ESP-IDF calibration scheme. A raw code is not yet a voltage.

**Why.** A level, a current shunt, or a temperature divider that lands on ADC2 will be missing or wrong whenever the radio uses the converter, and a DMA stream on ADC2 is the case the errata calls out.

**Source.** Pin names: ESP32-S3-WROOM-2 Datasheet v1.7, Table 3-1. Behavior: ESP-IDF Programming Guide, ESP32-S3, ADC Oneshot Mode, hardware limitations, and ADC Continuous Mode, hardware limitations. Errata: *ESP32-S3 Series SoC Errata*.

### 5.8 USB on this module is full-speed

**Rule.** The USB OTG interface is a full-speed and low-speed PHY compliant with USB 2.0 (section 5.2.1.7). USB Serial/JTAG is a full-speed device on the internal PHY (section 5.2.1.8). D− is GPIO19, D+ is GPIO20. There is no High-Speed (480 Mbit/s) PHY and no SuperSpeed PHY. If a design needs those rates, it is a different product, with a different connector budget and a different layout. A USB port a person can touch still gets IEC 61000-4-2 protection on VBUS and on the shield, and the data pins need a protection device that stays inside the USB eye at full-speed.

**Why.** Full-speed is 12 Mbit/s. Low-speed is 1.5 Mbit/s. Designing a High-Speed layout for a full-speed PHY wastes the board and still cannot move data at 480 Mbit/s.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, sections 5.2.1.7 and 5.2.1.8, Table 3-1. USB 2.0 Specification for the rates.

### 5.9 The antenna keep-out is part of the radio

**Rule.** Place the module as the ESP32-S3 Hardware Design Guidelines describe, in the section the module datasheet names: General Principles of PCB Layout for Modules. Copy that keep-out. Do not pour copper under the antenna, do not run traces through it, and do not put a metal wall, a battery, or a cable bundle against it. The module ships with a PCB antenna. Do not design a discrete antenna in its place. A modular radio certificate covers the module as tested. Antenna, ground, and enclosure changes can put an end product outside that certificate. When the product is placed on a market that requires a grant, the grant has to match the antenna and the enclosure that ship.

**Why.** The antenna is the copper on the module plus the board around it. Covering the keep-out detunes it, and the certificate no longer describes the product.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, Figure 3-1 note and section 11.2. The keep-out dimensions live in the hardware design guidelines, which is where the module sheet sends the reader. Section 1.1: RF certification is "see certificates."

### 5.10 The 40 MHz crystal is already on the module

**Rule.** Do not add load capacitors to the module's crystal. It is inside the can, specified as a 40 MHz crystal oscillator (section 1.1). Do not wash the assembled board in an ultrasonic cleaner, and do not ultrasonic-weld next to the module. If a design adds its own 32.768 kHz crystal on GPIO15 and GPIO16 (XTAL_32K_P and XTAL_32K_N), size those two capacitors from the crystal's load capacitance:

CL = (C1 × C2) / (C1 + C2) + Cstray

With equal capacitors, each one is 2 × (CL − Cstray). Cstray is the pin, the trace, and the pad, measured or estimated for that layout, not assumed to be zero.

**Why.** A second pair of load caps on an already-loaded oscillator pulls the frequency. Ultrasonic vibration can resonate the crystal blank until the module stops or its radio drifts.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, section 1.1, Table 3-1 (GPIO15, GPIO16), and section 12.4. The load equation is the standard crystal-load identity. Use the CL printed on the crystal datasheet.

### 5.11 Watchdog and brownout stay on

**Rule.** The module's feature list includes watchdogs. Run the watchdog. Kick it from the main control path, after that path has confirmed the outputs are in a safe state. An interrupt that still runs while the control path is dead must not be the only kick. Do not ship an image that leaves the watchdog off.

Set the brownout detector so execution stops while the rail is still inside the region where a flash write is legal. Table 6-7, taken from the flash vendor and not fully tested in production, rates the 3.3 V flash supply from 2.7 V to 3.6 V. A detector that waits until the rail is well below 2.7 V is already outside that rating. The same table rates endurance at 100,000 program/erase cycles and retention at 20 years. Do not use the module flash as a high-rate log.

**Why.** A locked control loop with the watchdog disabled leaves the last GPIO state driven. A flash write during a sag corrupts the image that should have rebooted the board into a safe state.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, section 1.1 (watchdogs) and Table 6-7 (flash voltage, endurance, retention). The brownout threshold itself is set in ESP-IDF. This file does not pick a timeout.

### 5.12 Touch pads are a poor fit next to conducted noise

**Rule.** The datasheet states that the ESP32-S3 touch sensor has not passed a conducted-susceptibility test and has limited application. Do not use a touch pad as a safety control, and do not rely on one as a user control in a machinery space, until that limit is gone from the datasheet.

**Why.** The inlet of this class of board is a conducted-noise environment. A sensor the vendor has already excused from that test will false-trigger.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, section 5.2.2.3, the note under the touch sensor.

### 5.13 Handle the module as MSL 3, and reflow it once

**Rule.** The module is MSL 3. Sealed bags stay below 40 °C and 90% RH. After opening, solder within 168 hours at 25 ± 5 °C and 60% RH, or bake. Reflow once, SAC305, peak 235 °C to 250 °C. Solder the ground pad if the thermal path needs it, with the paste volume the datasheet warns about: too much paste lifts the module and opens the other pins.

**Why.** A moisture-soaked module cracks in reflow. A second reflow is outside the condition the vendor printed.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, sections 12.1, 12.2, 12.3, and the ground-pad note in section 9. Factory ESD on the module is HBM ±2000 V and CDM ±500 V (section 12.2). That is a handling rating. Section 6.1 is the system test.

## 6. Pins and buses that leave the board

### 6.1 Every touched conductor gets system ESD

**Rule.** On every connector a person can touch, design for IEC 61000-4-2. Contact discharge is the preferred method. The level set is contact 2, 4, 6, and 8 kV, and air 2, 4, 8, and 15 kV. Level 4 is 8 kV contact and 15 kV air. Put the protection at the connector, with a short path to the chassis or to the board ground the standard's setup uses. The module's HBM of ±2000 V (section 12.2) is a factory test, ANSI/ESDA/JEDEC JS-001, typically 100 pF and 1.5 kΩ. CDM is JS-002. The IEC network is on the order of 150 pF and 330 Ω, and the currents are higher. Passing HBM does not mean the connector survives Level 4.

**Why.** A finger on a connector is the IEC event. The factory test is what the assembly line can do to a pin. They are not interchangeable.

**Source.** IEC 61000-4-2 for the levels and the network. ESP32-S3-WROOM-2 Datasheet v1.7, section 12.2, for the module's HBM and CDM. JS-001 and JS-002 for the names of those factory models.

### 6.2 One I²C bus has one set of pull-ups

**Rule.** I²C is open-drain. Place one pull-up to the bus voltage, once, for SCL and once for SDA. Count pull-ups inside every module on the bus. The minimum resistance is

Rp(min) = (VDD − VOL(max)) / IOL

For Standard-mode and Fast-mode, IOL is 3 mA and VOL(max) is 0.4 V. At 3.3 V, Rp(min) = (3.3 − 0.4) / 0.003 = 967 Ω. At 5.0 V it is 1.53 kΩ. The specification's worked example at the top of the 5 V range is (5.5 − 0.4) / 0.003 = 1.7 kΩ. Four 4.7 kΩ resistors in parallel are 1.18 kΩ. That network is still above Rp(min) at 3.3 V, and it is below Rp(min) at 5 V. Rise time, which sets Rp(max), comes from the mode and the bus capacitance in the same section of the specification.

**Why.** Each extra module that "helpfully" pulls the bus up moves the parallel value down. Below Rp(min) the low level no longer meets VOL, and the bus reads as stuck high or burns pad current.

**Source.** NXP UM10204, *I²C-bus specification and user manual*, section 7.1.

### 6.3 Level translation follows the pin's VIH and the pin's absolute maximum

**Rule.** A signal that swings above VDD + 0.3 V forward-biases the on-chip clamp (Table 6-3). Translate it. A signal that does not reach 0.75 × VDD will not read as a reliable high. "5 V tolerant" applies only to a pin whose datasheet says so, in the mode the datasheet names. GPIO47 and GPIO48 are 1.8 V (section 5.5). A resistor divider is acceptable for a slow, one-direction, high-to-low signal. A bus that is bidirectional, or fast, gets a translator rated for that edge rate.

**Why.** The clamp diode is an ESD structure. Using it as a level shifter dumps the excess voltage into the rail and can latch the chip up.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, Table 6-3 and Table 3-1 note 2.

### 6.4 The flyback diode sits at the coil

**Rule.** A DC coil (relay, solenoid, valve) gets a recirculation diode across the coil, at the coil, rated for the coil current and for at least the supply voltage. The loop from coil to diode is as small as the wiring allows. If diode recovery or wiring inductance still pushes the switch past its absolute maximum, add the snubber the switch datasheet shows. The diode belongs at the coil even when a transistor, and not a GPIO, is the switch.

**Why.** The current continues when the switch opens. A diode at the driver, with a metre of harness between it and the coil, leaves that harness inductance in the spike path.

**Source.** The switch datasheet's absolute maximum and its inductive-load application. Kirchhoff's laws for where the current goes.

### 6.5 Connectors

**Rule.** A connector a person mates in service is locking, polarized, and rated for the current, the voltage, and the environment. A 0.1 inch pin header is a board-to-board link or a test point, not a field connector.

Prefer USB Type-C for a full-speed service port (section 5.8). The Micro-B receptacle has a thin tongue that bends and then shorts the pins. Do not justify Type-C by a higher mating-cycle number. USB-IF mechanical compliance for Type-C uses EIA-364-09 and a 10,000 cycle minimum, and Micro-USB receptacles were commonly specified at 10,000 cycles as well. Directive (EU) 2022/2380 requires USB Type-C on listed categories of consumer radio equipment placed on the Union market. A private vessel controller is outside that list. The directive is not the reason. The tongue is.

A barrel jack is a bad inlet. Several plugs share a diameter, and neither the center pin nor the sleeve has a standard polarity. IEC 60130-10 is a connector family standard. It does not make two barrel plugs interchangeable.

**Why.** An unpolarized, unlatched, or fragile connector is how reverse polarity, an intermittent ground, and a shorted USB pair get onto a board that was otherwise designed correctly.

**Source.** USB Type-C mechanical qualification (EIA-364-09) in the USB-IF compliance documents. Directive (EU) 2022/2380, scope limited to the radio-equipment categories it lists. IEC 60130-10 for the barrel-connector family.

### 6.6 Test points are on the schematic

**Rule.** Add test points before placement, on rails, on grounds, on EN, and on the buses firmware has to watch. Keep them off USB D+ and D−. The 40 MHz crystal is inside the module and has nothing to probe. A bed-of-nails fixture follows IPC-9252.

**Why.** A point added after the layout lands on a strap, on a USB pair, or under a module, and the measurement changes the circuit.

**Source.** IPC-9252 for bare-board and in-circuit test fixtures. ESP32-S3-WROOM-2 Datasheet v1.7, Table 3-1, for which pins are USB and for the fact that the crystal is not pinned out.

### 6.7 A CAN bus is a transceiver plus TWAI, not a GPIO pair

**Rule.** If the board speaks CAN, the module's TWAI controller is compatible with ISO 11898-1 (CAN 2.0), standard and extended frames, 1 kbit/s to 1 Mbit/s. It still needs an external transceiver, the termination the bus requires, and the common-mode range that transceiver is rated for. Do not bit-bang the bus on two GPIOs.

**Why.** The controller implements the protocol. The transceiver survives the bus. One without the other is not CAN.

**Source.** ESP32-S3-WROOM-2 Datasheet v1.7, section 5.2.1.6. ISO 11898-1 and ISO 11898-2 for the protocol and the physical layer.

## 7. Parts and supply

### 7.1 Surface mount is the default. Through-hole stays where it is the right construction

**Rule.** Use a surface-mount part when the function exists in surface mount. Keep through-hole for connectors, fuse clips, relays, and mechanical anchors. Mixed assembly is normal.

**Why.** A through-hole resistor in a surface-mount design is a placement the line will get wrong. A surface-mount connector with no mechanical anchor breaks off the pad.

**Source.** IPC J-STD-001 for soldering requirements of both constructions.

### 7.2 Buy from an authorized source, and read the lifecycle line

**Rule.** Buy ICs and the module from the manufacturer's authorized distributors. A single-source part needs a written second source or a written accept of the risk. NRND and EOL mean the part is not a new design. On this module, datasheet v1.7 already marks two flash/PSRAM variants EOL (section 5). Product-change notices and discontinuance notices are how that status arrives. Check them.

**Why.** A gray-market reel is how a remarked or recovered die gets onto a board that then fails over temperature. A single-source part ends the product when the vendor ends the part.

**Source.** SAE AS5553 for counterfeit electrical, electronic, and electromechanical parts. JEDEC J-STD-046 for customer notification of product changes. JEDEC J-STD-048 for product discontinuance. ESP32-S3-WROOM-2 Datasheet v1.7, Table 1-1 and the versioning table (NRND and EOL watermarks).

### 7.3 A sensor is its datasheet

**Rule.** Specify a sensor from the manufacturer's datasheet: range, accuracy, supply, and what the reading does over time. A hobby module is not a characterization. A part whose datasheet gives no stability over time and no calibration method does not go on a board that will be trusted for a reading.

**Why.** The accuracy number on a breakout board is often the sensor's best-case line, copied without the conditions. The conditions are the specification.

**Source.** The sensor manufacturer's datasheet.

### 7.4 A relay is for isolation or for a form-C contact

**Rule.** Use a mechanical relay when the load must be galvanically isolated from the logic, or when the contact arrangement has to be form-C (break one circuit and make another). A DC load that a MOSFET can switch, with the flyback diode of section 6.4, is a MOSFET load. Rate the relay from its datasheet at that load current and that voltage, and use the cycle life at that load, not the mechanical life with no current.

**Why.** Contact life collapses once the contact is switching current. A relay used as a slow MOSFET also adds a coil current the supply has to carry, and a coil kick the diode has to catch.

**Source.** The relay datasheet, electrical endurance section.

## 8. Work this class of board does not take on

These are scope rules. Each one is a product of its own, with its own licence, grant, or supply chain.

- A Qualcomm or Broadcom application processor. The software stack, the NDA, and the reference design are a second product. The controller here is the ESP32-S3-WROOM-2.
- A custom radio, especially a sub-GHz radio. It needs its own grant, its own antenna, and its own crystal. The module already has a 2.4 GHz radio.
- A custom lithium pack. Section 4.2 applies to a cell used as the vendor built it. A welded multi-cell pack needs matching, a protection design, UN 38.3 on the pack as built, and IEC 62133-2.
- USB 3, or USB Power Delivery, unless a written requirement names the data rate or the voltage. USB 3.2 Gen 1 is 5 Gbit/s. This module is full-speed (section 5.8). Without a PD controller, a PD source stays at 5 V. EPR voltages, up to 48 V under USB PD 3.1, appear only after negotiation.
- Qi. The WPC specification, foreign-object detection, and the coil design are a charger product.
- Lightning, MFi, or Thunderbolt. Those are licence programs.
- A smartphone MIPI-DSI OLED as the product's display. The panel goes end-of-life with the phone, and the interface is not an industrial display interface.
- A discrete high-end audio path. This board is a controller.
- A 5G modem as the link, unless a requirement names cellular. Use a modem module the vendor still sells, with its antenna reference design, and treat it as a second radio under section 5.9.
- A custom ASIC. Mask cost, MOQ, and the NDA are a different company.

## 9. Accepting a change

**Rule.** Choose a part from its datasheet, its temperature range, its supply life, and, for a radio, its grant. Popularity is not a specification. Accept a circuit after a simulation or a measurement checked against those datasheet limits. A second written explanation of the same circuit is not that measurement. A review says which of these rules it did not check. Unit price is the last term. The cost that matters includes the connector, the fuse, the enclosure, the second source, and the failure, at the quantity that will actually be built.

Whether the product idea is worth building at all is outside this file.

The questions the environment forces, and that have to be answered before the schematic is trusted:

- Which alternator is fitted, and does ISO 16750-2 Test A or Test B apply?
- Where is the battery feeder fuse, and what is it, so the board fuse coordinates with it?
- Which connectors can a person touch?
- Which loads can turn on while the GPIOs are still high-Z, before firmware runs, and during the 3 ms strap window?
- What does the 3.3 V rail do, in volts and in time, before EN is allowed to rise?

**Why.** A model can restate a datasheet after a part number is already chosen. It does not know which alternator is on the engine, and it will happily confirm a circuit it has not simulated.

**Source.** Sections 2, 5, and 6 of this file. The measurement or the simulation is the acceptance record.

## 10. Claims that do not survive the documents

The notes this file was written against say the things in the first column. The documents say the second column.

| Claim in the notes | What the document says | Source |
| --- | --- | --- |
| USB 3 is a 5 GHz layout problem. | USB 3.2 Gen 1 is 5 Gbit/s. The Nyquist frequency of that NRZ stream is 2.5 GHz. This module does not implement USB 3 at all. | USB 3.2 specification. ESP32-S3-WROOM-2 Datasheet v1.7, section 5.2.1.7. |
| USB 2.0 is 400 Mbit/s. | High-Speed is 480 Mbit/s. This module's OTG PHY lists full-speed and low-speed only, which are 12 Mbit/s and 1.5 Mbit/s. | USB 2.0 Specification. Module datasheet section 5.2.1.7. |
| The strap pins are GPIO0, GPIO2, and MTDI, as on the original ESP32. | On this module the straps are GPIO0, GPIO3, GPIO45, and GPIO46. GPIO2 is ADC1_CH1. MTDI is GPIO41. | Module datasheet section 4 and Table 3-1. |
| Every strap pin needs an external resistor. | Add one only to change a default bit, or because another circuit can win the 3 ms hold. GPIO3 has no internal resistor and must not be left high-Z if its strap is used. A large capacitor on GPIO0 does not settle through a 45 kΩ pull inside that window. | Module datasheet Tables 4-1, 4-2, and 6-3. |
| ADC2 is dead for the whole time Wi-Fi is running. | That is the original ESP32 oneshot behavior. On ESP32-S3 the oneshot driver arbitrates with Wi-Fi, and a timeout means the sample is invalid. Continuous DMA from ADC2 is unsupported because the results are unstable. | ESP-IDF Programming Guide, ESP32-S3 ADC oneshot and continuous hardware limitations. ESP32-S3 Series SoC Errata. |
| A diode drop is 0.3 V to 7 V. | That range is a transcription error. Use Vf from the diode datasheet at the current and the temperature. | The diode datasheet. |
| Any 10 µF ceramic becomes 4 µF to 5 µF under bias. | There is no universal factor. Read the DC bias curve for that part number, voltage, and case size. | The capacitor manufacturer's bias data. |
| Four 4.7 kΩ I²C pull-ups are over the limit at 3.3 V. | Rp(min) at 3.3 V is 967 Ω. Four 4.7 kΩ in parallel are 1.18 kΩ, still legal at 3.3 V. The same network is under Rp(min) at 5 V (1.53 kΩ). | NXP UM10204, section 7.1. |
| Never use a relay, and never use a through-hole part. | A relay is the right part for galvanic isolation or a form-C contact. Through-hole is the right construction for connectors, fuse clips, relays, and anchors. | Relay datasheet. IPC J-STD-001. |
| Every lithium battery charges at 4.2 V CC/CV. | The charge voltage is the one in that cell's datasheet. LiFePO4 is a different voltage. An alternator field regulator is not a single-cell charger. | Cell datasheet. Section 4 of this file. |
| The module HBM rating of ±2000 V covers a connector a person can touch. | Section 12.2 is factory HBM and CDM. A touched connector is IEC 61000-4-2. Different network, different currents, different levels. | Module datasheet section 12.2. IEC 61000-4-2. JS-001. |
| EU law requires USB-C on this board. | Directive (EU) 2022/2380 applies to listed consumer radio equipment placed on the Union market. A private vessel controller is outside that list. Avoid Micro-B because the receptacle tongue is fragile. | Directive (EU) 2022/2380. |
| 10 kΩ is the required gate pull-down. | No standard sets that value. The module sheet does print 10 kΩ and 1 µF as the usual EN delay, to be adjusted to the real ramp. A gate pull is sized to hold the MOSFET off while the pin is high-Z, and to stay out of the strap sample. | Module datasheet section 9. Table 6-3. |
| On-chip ESD diodes replace a TVS at the connector. | The pad clamp is rated for factory HBM and CDM. An IEC strike into a GPIO destroys the pad. The TVS also does not stand in for load-dump energy. | IEC 61000-4-2. ISO 16750-2. Module datasheet section 12.2. |
| The supply only has to cover the average current. | Table 6-2 requires an external supply of at least 0.5 A. Table 6-4 publish transmit peaks up to 355 mA for the module alone, at 100% duty. | Module datasheet Tables 6-2 and 6-4. |

## Documents

Limits for the controller come from one file:

- Espressif, *ESP32-S3-WROOM-2 Datasheet*, version 1.7. Local copy: `MarineBoard/Documentation/esp32-s3-wroom-2_datasheet_en.pdf`.

The module sheet defers, and this file follows it only that far, to:

- Espressif, *ESP32-S3 Hardware Design Guidelines*, section General Principles of PCB Layout for Modules (antenna keep-out and placement).
- Espressif, *ESP-IDF Programming Guide*, target ESP32-S3, ADC oneshot and ADC continuous hardware limitations.
- Espressif, *ESP32-S3 Series SoC Errata*, for the ADC2 DMA limitation.

The two bucks and the polymer named in section 3:

- Texas Instruments, *TPS5430, TPS5431*, SLVS632K, revised January 2024. Local copy: `MarineBoard/Documentation/tps5430.pdf`.
- Silergy, *AN_SY8089A1*, Rev. 0.0 (2018). Local copy: `MarineBoard/Documentation/silergy_sy8089a1aac_xonjuly20_12_link-2.pdf`. The copy is old. A current Silergy datasheet replaces it where they differ.
- Panasonic, SVPE series, 10SVPE220M row, characteristics list dated 01 Apr 2022. Local copy: `MarineBoard/Documentation/Panasonic SVPE OS-CON datasheet (10SVPE220M).pdf`. The sheet says to confirm the current delivery spec.

Other documents named above: USB 2.0 Specification section 7.2.4.1. USB Type-C specification, sink CC termination. USB 3.2 Specification. IEC 61000-4-2. ANSI/ESDA/JEDEC JS-001 and JS-002. ISO 7637-2. ISO 16750-2. ISO 11898-1 and ISO 11898-2. ISO 10133. ABYC E-11. IEC 62368-1. IEC 60664-1. NXP UM10204 section 7.1. Directive (EU) 2022/2380. USB-IF Type-C compliance (EIA-364-09). IEC 60130-10. Texas Instruments SLVA139. IPC J-STD-001. IPC-9252. JEDEC J-STD-046 and J-STD-048. SAE AS5553. UN 38.3. IEC 62133-2. CISPR 32. FCC Part 15 Subpart B. The datasheet of the inductor, the TVS, the diode, the cell, the relay, and the sensor actually fitted.
