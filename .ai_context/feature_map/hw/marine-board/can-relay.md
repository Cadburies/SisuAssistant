---
title: Marine Board › CAN, relay & I²C
id: hw/marine-board/can-relay
kind: hardware
tags: can nmea 2000 seatalkng relay spdt i2c qwiic termination jp1
status: live
script: can-relay.sh
image: MarineBoard/Documentation/CAN INTERFACE.png, MarineBoard/Documentation/OUTPUT RELAYS.png
order: 50
---
NMEA 2000 CAN on **U7** (termination jumper **JP1**), SPDT relay contacts on **U12**, and a Qwiic-style I²C port **CN3**.

- **Reach:** Connectors **U7** (CAN), **U12** (relay NC/CO/NO), **CN3** (I²C)
- **Action:** fit JP1 only if the board ends the CAN backbone; relay switched by firmware.
- **Needs:** physical access to the board; power off before wiring
- **Expect:** CAN traffic visible in Signal K when wired; relay clicks on command.
- **Source:** MarineBoard/Technical Specs.md (§Interfaces (as built)) · `MarineBoard/MarineBoard.kicad_sch`
