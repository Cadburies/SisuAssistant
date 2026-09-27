---
title: Marine Board › Power input (CN1)
id: hw/marine-board/power
kind: hardware
tags: power input 12v battery cn1 fuse f1 tvs reverse polarity usb-c
status: live
script: power.sh
image: MarineBoard/Documentation/POWER AND FILTERING 3V3 from 5V merge.png
order: 10
---
12 V battery in on **CN1** (GND, +12V BAT) through reverse diode, fuse F1, SMBJ18A TVS and filter; USB-C powers logic/programming only.

- **Reach:** Connector **CN1** on the board edge
- **Action:** wire battery + and GND; 9–15 V DC.
- **Needs:** physical access to the board; power off before wiring
- **Expect:** 3.3 V logic up; relay/PWM/4–20 mA only work with 12 V (not USB). Schematic shown: the 5 V → 3.3 V stage (SY8089).
- **Source:** MarineBoard/Technical Specs.md (§Power supply) · `MarineBoard/MarineBoard.kicad_sch`
