## Instruction Set: Generic Marine Applications Board with Integrated Controls

This instruction set defines a single PCB design for a generic marine applications board using one ESP32-S3-WROOM-2 module to handle single alternator control (optimized for one board per engine room), two generic relay outputs, two pressure-based level sensors (0-1m range), and two thermostat functions. The board incorporates INA226 for battery/alternator measurements (addr 0x40), level monitoring (addrs 0x41/0x45), PWM control for field (single primary, redundant second optional), integration with Home Assistant/SignalK (via MQTT or CAN), EMI mitigation with ferrite beads, shielded traces, and bypass caps, isolation via optocouplers on digital outputs and galvanic isolation for relays, handling of heavy currents with thicker traces and separate power zones, and common monitoring of battery levels, WiFi connection status, and HA/SignalK capabilities. All external connections use well-marked breakout points with screw terminals: standard size (e.g., 3.5mm pitch) for small signals (I2C, DS18B20, RPM, CAN, relays, pressure sensors, enable, shunt sense lines, 3.3V breakout), bulkier size (e.g., 5mm pitch, rated 30A+) for battery and field PWM signals. The 3.3V breakout (screw terminal, 1A max, with fuse/polyfuse for protection) is grouped with other low-amp terminals. The TMP sensors and relays are generic and not necessarily related; e.g., TMP1 can monitor alternator temperature to regulate PWM amps output via software to prevent overheating, or monitor freezer temperature to switch RLY1 for compressor control. TMP2 and RLY2 are for future/optional use. Additional features include a battery charger for LiFePO4 (via MCP73831) and +5V regulated output (via AMS1117-5.0), with CAN interface for expanded connectivity.

#### Design Goals & Constraints

The system provides accurate battery voltage and alternator/field current monitoring via INA226 (one INA226 at 0x40 handles battery voltage directly (up to 36V safe) and shunt voltage/current for the alternator via external shunt; levels via two INA226 at 0x41/0x45 measuring differential voltage across 250Ω resistors for 4-20mA sensors). PWM control for field (single primary, redundant second optional). Relay switching for two generic loads (e.g., compressors), pressure monitoring for two tanks (submersible 4-20mA sensors, 0-1m depth, mounted inside tanks with extended cabling to remote board), and two thermostat functions (DS18B20 temperature sensing for generic control). INA226 handles low-voltage measurements for accuracy and EMI resistance, measuring battery voltage directly (VBUS to +12V) and shunt voltage (0-75mV range, typically 0-37mV for 0-200A with a 75mV/400A shunt). No voltage dividers are used. Isolation uses optocouplers (PC817C-S) on PWM lines to prevent ground loops and noise coupling from high-current engine circuits to ESP32. EMI protection includes ferrite beads (BLM21PG331SN1D) on power/I2C lines, 0.1µF bypass caps (e.g., C1525) near ICs, ESD diodes (ESD52328T1G) on inputs, and shielded I2C cables if extended. Software filters (median + moving average) handle noisy readings. For heavy currents, high-current paths (field drivers, supply lines) use separate PCB layers/zones with 2-4oz copper, min 50mil traces for 30A+, and thermal vias; shunt sense lines are low-current/voltage only (shunts are external). Relays switch generic loads, with logic to disable during overcurrent/low voltage via HA automations or ESP lambda. Relays are rated 10A/240V. Common features: Continuous battery level monitoring (from INA226 at 0x40), WiFi connection status (via ESPHome entity), and HA/SignalK integration (MQTT enabled by default for SignalK topics; CAN for Victron, Raymarine, and Yanmar engines). Power input is 9-32V (marine variable) with max 500mA draw for control components (ESP + drivers); field MOSFET can draw significantly more (e.g., 10A+ per field, handled separately via PWM outputs on high-current tracks). Safety features include failsafe shutdown on errors and no single-point failures. PWM signal from ESP32 goes through optocouplers to MOSFET drivers (TC4427EPA); MOSFETs (IRL60R075CFD7) switch high current (up to 20A for field), so PCB requires high-current tracks for PWM outputs (post-MOSFET) and related supply lines only. Battery charging supports LiFePO4 via +5V input (e.g., USB), with status LED and fused +5V output.

#### Required GPIO Mapping

Single ESP32-S3-WROOM-2 handles all functions; I2C shared with addresses differentiating devices. TMP sensors are generic for thermostat functions.

- I2C SDA: GPIO18 (shared for INA226s)
- I2C SCL: GPIO5
- PWM1: GPIO14 (via opto to driver)
- PWM2: GPIO16 (via opto to driver; redundant/optional)
- TMP1: GPIO15 (one-wire, generic temp sensor, e.g., for alternator or freezer thermostat)
- TMP2: GPIO19 (one-wire, generic temp sensor for future/optional use)
- Status LED: GPIO17
- RPM Input: GPIO4 (hall sensor or direct alternator winding wire input, interrupt-driven)
- CAN TX/RX: GPIO1/3 (for Victron/Raymarine/Yanmar/SignalK)
- RLY1: GPIO9 (opto-isolated, generic relay, e.g., for compressor control via thermostat)
- RLY2: GPIO10 (opto-isolated, generic relay for future/optional use)
- Enable Input: GPIO12 (via opto for 12V compatibility)
- Error Buzzer: GPIO21 (gpio output)

#### Breakout Points List

All GPIOs and connections routed to marked screw terminals. Shunt sense lines use standard terminals due to very low voltage/current. Optimized for single shunt (SH+ / SH-). RPM breakout: Simple wire from alternator windings or hall sensor to "RPM_IN" terminal (standard size, with pull-up resistor on-board for signal conditioning). TMP breakouts are generic for any temperature monitoring. Added +5V fused output and charging input from battery charger block.

| Marking     | Size/Pitch      | Expected Amps | Description                                                                          |
| ----------- | --------------- | ------------- | ------------------------------------------------------------------------------------ |
| BAT+        | 5mm, bulkier    | 30A+          | Battery positive input to power block and INA226 VBUS for direct voltage measurement |
| BAT-        | 5mm, bulkier    | 30A+          | Battery negative (GND)                                                               |
| SH+         | 3.5mm, standard | Low (mA)      | Shunt positive sense line to INA226 VIN+ (external shunt for alternator current)     |
| SH-         | 3.5mm, standard | Low (mA)      | Shunt negative sense line to INA226 VIN-                                             |
| PWM1        | 5mm, bulkier    | Up to 20A     | PWM1 output for alternator field (high-current post-MOSFET)                          |
| PWM2        | 5mm, bulkier    | Up to 20A     | PWM2 output (redundant/optional)                                                     |
| LVL1        | 3.5mm, standard | 4-20mA        | Level sensor 1 input (pressure sensor signal to INA226 at 0x41)                      |
| LVL2        | 3.5mm, standard | 4-20mA        | Level sensor 2 input (pressure sensor signal to INA226 at 0x45)                      |
| SPWR        | 3.5mm, standard | Up to 1A      | Sensor power output (+12V fused for pressure sensors)                                |
| TMP1        | 3.5mm, standard | Low (mA)      | DS18B20 temperature sensor 1 (one-wire bus)                                          |
| TMP2        | 3.5mm, standard | Low (mA)      | DS18B20 temperature sensor 2 (one-wire bus)                                          |
| RPM_IN      | 3.5mm, standard | Low (mA)      | RPM input from alternator or hall sensor                                             |
| ENBL        | 3.5mm, standard | Low (mA)      | Enable input (opto-isolated, bridge to 3.3V or external 12V switch)                  |
| CANH        | 3.5mm, standard | Low (mA)      | CAN high line                                                                        |
| CANL        | 3.5mm, standard | Low (mA)      | CAN low line                                                                         |
| N1O/N1C/C1O | 3.5mm, standard | Up to 10A     | Relay 1 contacts (NO/NC/Common) for generic load                                     |
| N2O/N2C/C2O | 3.5mm, standard | Up to 10A     | Relay 2 contacts (NO/NC/Common) for generic load                                     |
| 3V3         | 3.5mm, standard | Up to 1A      | 3.3V fused breakout for low-power sensors                                            |
| 5V          | 3.5mm, standard | Up to 1A      | 5V fused output from regulator (AMS1117-5.0)                                         |
| VBAT        | 3.5mm, standard | Up to 500mA   | Battery connection for charger (LiFePO4 output)                                      |
| +5V_IN      | 3.5mm, standard | Up to 500mA   | +5V input for battery charging (e.g., USB via JST-GH)                                |
| SDA/SCL     | 3.5mm, standard | Low (mA)      | I2C bus breakout (shared)                                                            |
| GND         | Shared          | –             | Ground terminals (multiple for convenience)                                          |

#### External Components (BOM Additions)

| Part                       | Qty | Key Specs / Reason                                                                                                                                                                                                                                   | Approx. Price |
| -------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| External Shunt             | 1   | 400A/75mV; for alternator current measurement, Kelvin-connected via two sense wires to SH+/SH- (only external shunt required; no on-board high-current shunt)                                                                                        | 10–20 €       |
| DS18B20 Temperature Sensor | 2   | Waterproof one-wire sensors; for generic use (e.g., alternator TMP1, freezer TMP1; TMP2 optional)                                                                                                                                                    | 2–5 € each    |
| Pressure Sensor            | 2   | Submersible 4-20mA output, 0-1m H2O (0-0.1 Bar), 12-30V supply, IP68 stainless steel, 10-20m cable; low-pressure range for tanks, marine robust (e.g., BD Sensors LMP307, YSI WL400, or ATO.com low-range equivalent for accuracy in shallow depths) | 50–100 € each |

#### Schematic Overview

Power and Filtering Section: Ferrite beads (BLM21PG331SN1D) on input for EMI; buck converter (TPS5430DDA) for 3.3V with input protection (1N5819HW-7-F diode, 5A fuse); fused outputs for +12V and +3.3V; 3.3V breakout grouped with low-amp terminals.

INA226 Sections: Battery/alternator monitoring: One INA226 (U12, addr 0x40) with VIN+ / VIN- across single external shunt (SH+ / SH- terminals, low-voltage sense only), VBUS to battery+ (direct 12V measurement, terminal "BAT+"). Levels monitoring: Two INA226 (U4/U5, addrs 0x41/0x45) for pressure sensors, measuring differential voltage across 250Ω resistor (R_shunt_current required). 4.7kΩ I2C pull-ups shared.

PWM Drivers: Optocouplers (PC817C-S) isolate ESP GPIO from drivers (pull-ups ensure fast switching); drivers (TC4427EPA) to MOSFETs (IRL60R075CFD7) which switch high current; outputs to bulkier terminals ("PWM1/PWM2") with high-current tracks; protection diodes (MURS360T3G).

Relays: GPIO9/10 → optocouplers (input LED side to ESP 3.3V via 1kΩ resistor) → output transistor drives relay coil (with flyback diode if mechanical); relay contacts switch generic loads (isolated from ESP ground, terminals "N1O/N1C/C1O", "N2O/N2C/C2O").

Levels: INA226 (U4/U5) for two sensors, each powered from +12V ("SPWR", required). Current loop: +12V → sensor+ → sensor- → 250Ω resistor → GND. Measure shunt voltage across resistor. ESD protection (ESD52328T1G) on inputs.

Thermostat: Relays on GPIO9/10 for generic switching (integrated with thermostat logic via TMP1/TMP2); DS18B20 on GPIO15/19 ("TMP1/TMP2", generic).

Battery Charger: +5V input (e.g., via JST-GH connector) to MCP73831-2-OT for LiFePO4 charging (PROG 2K resistor for current); status LED; +12V to AMS1117-5.0 for +5V output; protection diodes (SS14); fused +5V.

Enable Input: "ENBL" terminal → 1kΩ resistor → optocoupler LED+; LED- to "GND" terminal. Opto output: Collector to GPIO12 (with pull-down 10k to GND), Emitter to GND. Bridge wire across "ENBL" and 3.3V breakout pulls up (enables); or wire 12V switch/engine power to "ENBL" for conditional enable. If GPIO12 low, enter deep sleep.

Error Buzzer: GPIO21 → active buzzer (positive pin); other buzzer pin to GND.

RPM Circuit: "RPM_IN" terminal to GPIO4; on-board pull-up (10k to 3.3V) and optional low-pass filter (RC) for noisy alternator winding signals; interrupt for frequency counting.

CAN Interface: TJA1050T/CM transceiver; ESD protection (PESD1CAN); common-mode choke (DLW21SN900SQ2L); 120Ω termination jumper (JP1).

EMI Enhancements: Star-grounding (separate analog/digital grounds tied at one point); shielded traces for I2C; TVS diodes on exposed lines.

Heavy Current: External shunt paths bypass PCB; high-current tracks on PCB for field PWM outputs and supply only (no high-current through shunts on PCB).

DS18B20/LED/RPM/CAN: As specified; terminals marked (e.g., "CANH/CANL", "RPM_IN").

#### PCB Layout Rules

Kelvin shunt sense (low-current) to INA226 VIN+/VIN- minimize trace resistance errors. Place INA226 near sense terminals for short traces; separate from high-current PWM areas. Zones: High-current (drivers/relays/supply) on top layer with 2oz copper min; low-power (ESP/I2C/INA226) on bottom; ground plane split (analog/digital) with single tie. EMI: Route I2C/PWM away from high-current traces (min 20mil clearance); add guard rings around sensitive analog; via stitching for shields. Heavy Currents/Engine Room: Thicker traces (100mil+ for 30A) for PWM outputs/supply; thermal vias under drivers; conformal coating for humidity; mounting holes for vibration-proof enclosure. Relays: Place near edges for easy wiring; isolate control traces with optos; add snubbers (RC across contacts) for inductive loads. Breakouts: Group and label screw terminals clearly (silkscreen: e.g., "BAT+ (30A MAX)"); bulkier ones clustered for heavy wires; 3.3V/5V breakouts with low-power section. Enable terminals near power section for easy wiring. Buzzer placed for audible access. General: 2-layer PCB min (4-layer for better EMI if budget); min 8mil traces elsewhere; JLCPCB-compatible. TMP and relay placements generic for flexible use.

#### YAML Configuration (Separate Files per Function)

YAML files remain separate for each function (alternator.yaml, relay.yaml, level.yaml), with includes for common elements (e.g., common.yaml for battery monitoring, WiFi, HA/SignalK/MQTT). Flash the appropriate YAML based on deployment, but since one board, a combined YAML (marine_generic.yaml) can include all via <<: !include. Common: Battery voltage entity always present; WiFi status sensor; MQTT enabled for SignalK (topics like "vessels/self/electrical/alternators/current"). Thermostat logic uses generic TMP/RLY pairings. Add charger status monitoring if applicable (e.g., via GPIO on STAT pin).
