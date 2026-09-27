---
title: Marine Board › Display connector & GPIO headers
id: hw/marine-board/display-headers
kind: hardware
tags: display qspi 4 inch 480x480 fpc j2 touch header h6 h7 gpio spare
status: live
script: display-headers.sh
image: MarineBoard/Documentation/FSPI (new).png
order: 60
---
Connector **J2** for a 4.0" 480×480 QSPI touch display (FSPI bus, backlight, I²C touch), plus two 2-pin headers **H6** (GPIO39, GPIO16) and **H7** (GPIO5, GPIO6) for spare I/O.

- **Reach:** Board edge: **J2** FPC connector (18-pin display) and the two 2-pin male headers **H6**, **H7**
- **Action:** plug in the display's FPC (contacts per the connector orientation) or jumper spare GPIOs from H6/H7.
- **Needs:** physical access to the board; power off before plugging the FPC
- **Expect:** Display powers from +3.3 V with backlight on GPIO18 and touch on the shared I²C bus once firmware drives it; H6/H7 pins are plain 3.3 V GPIO.
- **Source:** `MarineBoard/MarineBoard.kicad_sch` (J2, H6, H7) · MarineBoard/Technical Specs.md (§Interfaces)
