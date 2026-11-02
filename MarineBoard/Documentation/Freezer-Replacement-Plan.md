# Weekender freezer: Marine Board replacement plan

**Status:** plan only. The firmware still energises the relay to run (#220). **Date:** 2026-11-02.

The National Luna display and button board has failed. It still shows battery voltage, and it holds the compressor on. This plan replaces that board with a Marine Board. The Danfoss module on the compressor stays. The LilyGo S3 AMOLED is the only screen.

The crew wiki is generated from [`.ai_context/feature_map/`](../../.ai_context/feature_map/) and only carries a short page per device. Those pages point here. This file is the write-up.

Photos: [the module](Freezer/Freezer%20Controller.jpeg), [the nameplate](Freezer/Freezer%20Model.jpeg).

## The machine

Single cabinet, one compressor.

| | |
|---|---|
| Maker | National Luna, Weekender, South Africa |
| Refrigerant | R134a, 50 g, climate class T |
| Compressor | Danfoss BD35F |
| Running current on the plate | 2.5 A at −18 °C on 12 V DC, 0.40 A on 230 V AC |
| Electronic unit | Danfoss **101N0500**, 12/24 V DC and 100–240 V AC, on the compressor |

The 101N0500 is the motor driver. It soft-starts the BD35F, picks AC when both supplies are present, and has its own low-voltage and thermal cut-outs. The small plug beside the battery terminals is the thermostat. The failed board is the other PCB, the one with the display and the buttons. It is not in the photos.

Terminals on the 101N0500, from the Danfoss instruction DEHC.PI.100.B1.02:

| Terminal | Function | Where it stays |
|---|---|---|
| L, N | 100–240 V AC mains | On the module. 4 A fuse in L |
| +, − | 12/24 V battery. Module must be wired straight to the battery | On the module. 15 A fuse at the battery |
| F | Condenser fan, between + and F. Regulated 12 V, 0.5 A average | On the module |
| A | Interior lamp, between A and C. Regulated 12 V, 5 W, 0.5 A | On the module |
| C, T | Thermostat loop. A few milliamps. Closing it runs the compressor | Marine Board relay |
| C, P | Battery-protection resistor | Jumper, see below |
| D | Fault LED, 10 mA, between + and D | Marine Board ENBL opto, so the LilyGo can show the code |

Compressor current does not flow in C–T. The nameplate 2.5 A stays on + and −.

Speed is the resistance between C and T, from Fig. 5 of that instruction, for this module:

| Resistance | Speed | Loop current |
|---|---|---|
| 0 Ω | 2,000 rpm | 5 mA |
| 277 Ω | 2,500 rpm | 4 mA |
| 692 Ω | 3,000 rpm | 3 mA |
| 1,523 Ω | 3,500 rpm | 2 mA |

3,500 rpm is full speed on a 101N0500. This module has no adaptive-speed mode.

With P left open, the module's own floor is 10.4 V cut-out and 11.7 V cut-in (Fig. 3). A 0 Ω link from C to P moves that floor to 9.6 V cut-out and 10.9 V cut-in (Fig. 4, first row).

Fault flashes on D, a quarter-second each, then a pause, repeating every 4 seconds:

| Flashes | Meaning |
|---|---|
| 1 | Module battery cut-out. Voltage outside the module's own setting |
| 2 | Fan over-current, above about 1 A peak |
| 3 | Motor did not start. Rotor blocked, or differential pressure above about 5 bar |
| 4 | Cannot hold minimum speed. System too heavily loaded |
| 5 | Module thermal cut-out. Cabinet overcharged, high ambient, or the module is too hot. It will run again once cool |

## What failed, and how to stop it now

The dead display board is holding C–T closed, so the 101N0500 runs at whatever speed that loop's resistor sets, and it never stops. The voltage reading is the one part of that board still alive.

To stop the compressor before the Marine Board is fitted, unplug the small thermostat connector (F, A, C, D, C, P, T). Leave + and − on the battery. An open C–T loop is stopped. Plugging that connector back in, with the failed board still on it, starts the compressor again.

## Fail-safe

A dead ESP32 must leave the compressor running at full speed. The relay is the SPDT on GPIO7 (U12). Coil off is the unpowered state, and that state is normally closed.

```
Danfoss C -- 1,523 ohm -- U12 NC
Danfoss T -------------- U12 COM   (RLY1_COM, F4 is in this leg)
```

| Relay coil | Contact | Compressor |
|---|---|---|
| Off. ESP unpowered, crashed, or still booting | NC closed through 1,523 Ω | Runs at 3,500 rpm |
| On. GPIO7 high | NC open | Stopped |

The run contact is the normally closed contact. Full speed is the 1,523 Ω resistor in that contact, not a short. A short would be 2,000 rpm.

F4 is a 10 A fuse in the common. The loop is 2 mA, so the fuse does not open in normal use. The compressor's battery cables do not go through this relay or this fuse.

While the ESP is alive and the probe is missing, the firmware energises the relay and holds the compressor off. A live board with a dead probe must not cool blind. An ESP that is actually dead cannot do that. The compressor then runs at 3,500 rpm until the Danfoss module reaches its own floor: 9.6 V cut-out and 10.9 V cut-in with the C–P jumper fitted, or the module's thermal cut-out. That is the cost of this fail-safe. Full speed draws more than the 2,000 rpm setting. The 2.5 A on the nameplate is the plate's figure at −18 °C, not a promise at 3,500 rpm.

On every boot the coil is off, so the compressor runs until the probe has been read. If the cabinet is already at or below the setpoint, the firmware energises the relay as soon as that reading exists. The three-minute minimum run does not apply to that first decision. The 101N0500 has its own restart delay, which limits a reboot storm.

### The MOSFET cannot switch the speed loop

Q4 (GPIO38, CN2 PWM) is the field driver. It is a low-side MOSFET. The source is ground. The drain has D8, a VS-43CTQ100S, freewheeling to +12 V, and F3, a 10 A fuse, in the same path. It is built to switch a 12 V load of about 10 A.

The Danfoss thermostat loop is a current source of a few milliamps between C and T. It is not a 12 V load, and neither terminal is battery ground. Putting C or T on CN2 PWM ties that loop to ground and gives D8 a path toward +12 V. The gate pull-down would at least fail in the right direction (MOSFET off, resistor left in circuit, full speed), and the copper still makes the pin the wrong switch.

One SPDT has two states. Those two states are full speed and stop. The Weekender's low speed, 2,000 rpm below 12.6 V and 3,500 rpm above 13.2 V, with Turbo forcing 3,500 rpm, needs a third state: a contact across the 1,523 Ω that shorts it for 2,000 rpm. That contact has to be open when the ESP is dead, or a dead board would drop to low speed. Q4 cannot be that contact.

This plan does not add a second relay. The freezer runs at 3,500 rpm or it is stopped. Auto low-speed and Turbo are not in this design. A later optocoupler or signal relay, driven from a CN4 pin and mounted in the Marine Board enclosure, can short the 1,523 Ω later. CN4 is unprotected 3.3 V and stays inside the box.

## Battery protection

Fit a jumper from C to P. The module's own floor is then 9.6 V cut-out and 10.9 V cut-in, which is the Weekender Low setting. Med and High are enforced by the firmware opening the run path (coil on) earlier. The module cannot be talked into running below 9.6 V, which is what we want for a dead ESP.

While the ESP is alive, the selected level uses both a cut-out and a cut-in. A start, including the first start after power-up, waits until the voltage is above the cut-in. These are the Weekender / Danfoss 12 V numbers, measured on the same wires as the module's + and −:

| Level | Cut-out | Cut-in |
|---|---|---|
| Low | 9.6 V | 10.9 V |
| Med | 10.4 V | 11.7 V |
| High | 11.3 V | 12.5 V |

High will refuse to start until the battery is up near 12.5 V. That matches the Weekender panel.

U2 INA226 reads bus voltage, with U4 SH+ and SH− both on that same 12 V feed. The chip is scaled for a 400 A / 75 mV shunt, so with the two sense pins tied to the feed it reads voltage only. The screen shows voltage. A firmware cut-out does not flash Danfoss code 1. Code 1 appears only when the module itself has cut out.

## Setpoint

The Weekender single-bin thermostat spans +20 °C to −30 °C in 1 °C steps. The Marine Board stores the setpoint. Fridge at 4 °C and freeze at −5 °C stay as shortcuts inside that range. The probe is one DS18B20 on U13 TMP1 (GPIO15), on the bin wall where the National Luna sensor sits.

The three-minute minimum run and minimum off stay for normal cycling. They do not apply to a missing probe, and they do not apply to the first decision after boot.

## Display, beep, and the status LED

The LilyGo (`freezer_display.yaml`, 192.168.10.47) is the freezer display. It shows the cabinet temperature, the setpoint, cool or off, compressor running or stopped, battery voltage, the protection level, whether a firmware cut-out is active, the Danfoss fault code and its meaning, probe status, and whether the direct link and HA are up.

Setpoint, cool/off, and the protection level can be changed on the LilyGo and in HA. There is no Turbo control in this design, because the speed is always full.

No fault lamp, run lamp, mains lamp, or polarity lamp is added. The 101N0500 already refuses to run if + and − are reversed. Fan and lamp stay on terminals F and A.

The Marine Board keeps its buzzer (GPIO2) and RGB LED (GPIO1) as local indications:

| State | LED | Buzzer |
|---|---|---|
| Compressor running | Cyan, solid | Silent |
| Cooling, held off because the cabinet is cold | Green, short flash | Silent |
| Thermostat off | White, short flash | Silent |
| Probe missing, compressor held off | Amber | Short pattern while the fault is new |
| Firmware battery cut-out | Red, slow flash | Short pattern when the cut-out starts |
| Danfoss fault code, or a firmware fault | Red, fast flash | Short pattern when the code appears |
| HA API down | Blue, short flash | Silent. Control continues |

The buzzer is the magnetic KLJ-4020 and uses the existing PWM helpers. A steady GPIO high does not make a tone.

## Who is in charge

The Marine Board runs the thermostat, the battery levels, the probe check, and the relay. It does not read the LilyGo or HA to decide whether to cool. The setpoint is stored on the Marine Board. HA and the LilyGo are both clients.

On the boat, both boards join Sisu-IoT. HA uses the existing ESPHome API on the Marine Board to read every value and to write the setpoint, the mode, and the protection level. That write goes to the Marine Board, which then applies it.

Off the boat, on a vehicle with no Home Assistant and no router, the two ESP32s still work. The link for that is ESP-NOW, ESPHome `espnow` plus `packet_transport`, encrypted, peers limited to the two MAC addresses. The key name, when the firmware is written, is `freezer_espnow_key`. It is not added to the secrets files in this plan.

The Marine Board publishes temperature, target, mode, compressor, voltage, protection level, cut-out, fault code, and probe status. The LilyGo publishes the requested setpoint, mode, and protection level when a finger changes them. The Marine Board applies the last request from either the LilyGo or HA and publishes the value it actually stored, so the other client follows.

ESP-NOW uses the Wi-Fi radio. With no access point, both boards use one fixed channel, the same number in both YAML files. Once both have joined Sisu-IoT, ESP-NOW has to use that access point's channel. On the boat the direct link works because both stations are on the same AP. The LilyGo also keeps today's Home Assistant sensors as a fallback for the screen: if ESP-NOW has gone quiet and the API is connected, it shows the HA values. Away from the boat that fallback is simply absent. If ESP-NOW is quiet too, the screen says the controller is missing, and the Marine Board carries on with the stored setpoint.

The LilyGo does not use the Marine Board web server as its link. That server is for bench work and it needs a shared IP network.

## What the firmware does today

`freezer_marineboard.yaml` still energises GPIO7 to run, on U12 NO. A dead ESP opens that contact and the compressor stops. The battery flag is a fixed 11.0 V with no cut-in. The setpoint limits are −50 °C to +30 °C. The LilyGo reads HA only, and shows NO HA when Home Assistant is down.

Do not land the Danfoss C–T loop on NC until a firmware build that matches this plan is on the board. Wiring NC against today's YAML stops the compressor whenever the ESP is alive and running the thermostat.

## Wiring once the firmware matches

| From | To |
|---|---|
| House 12 V and 0 V | Danfoss + and −, fused 15 A at the battery. Also Marine Board CN1 |
| Same 12 V pair | U4 SH+ and SH−, for the voltage reading |
| Danfoss C | 1,523 Ω, then U12 NC |
| Danfoss T | U12 COM |
| Danfoss C to Danfoss P | Jumper, 0 Ω |
| Danfoss + and D | ENBL opto on U13, in the 10 mA LED loop. Check the onboard series resistor against that 10 mA before connecting |
| DS18B20 | U13 pin 3 TMP1, ground, and 3.3 V |
| Danfoss L, N, F, A | Left as they are |
| CN2 PWM, Q4 | Nothing on this freezer |

The v1.9.1 boards are not on the boat. The retired v1.00 prototype is not the board to fit. `homeassistant/esphome/archive/freezer.yaml` stays retired.

## Firmware to write later

Against `freezer_marineboard.yaml` and `freezer_display.yaml`:

1. Invert the relay. Coil on means stop. Coil off means run at 3,500 rpm.
2. Setpoint +20 °C to −30 °C, step 1 °C. Keep the 4 °C and −5 °C presets.
3. Protection select: Low, Med, High, with the cut-out and cut-in above. No start below the cut-in.
4. Probe missing, while the ESP is alive, forces the coil on. Skip the minimum run time for that, and for the first decision after boot.
5. Count D-terminal flashes on GPIO8 and publish the code.
6. Buzzer and RGB as in the table above.
7. ESP-NOW, encrypted, fixed peers, fixed channel when Wi-Fi is down.
8. LilyGo draws the screen from ESP-NOW, falls back to HA only while the API is up, and sends setpoint, mode, and protection back over ESP-NOW.
9. Add `freezer_espnow_key` to `secrets.yaml` and `secrets.yaml.example` in that same change.

HA dashboards keep reading the Marine Board entities. They gain the protection level and the fault code when those entities exist.
