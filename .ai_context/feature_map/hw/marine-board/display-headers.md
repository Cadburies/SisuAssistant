---
title: Marine Board › Display header (U10)
id: hw/marine-board/display-headers
kind: hardware
tags: display spi tft header u10 jst gh sm10b backlight gpio
status: live
script: display-headers.sh
image: MarineBoard/Documentation/HEADER PINS.png
order: 60
---
Connector **U10** (JST-GH 10-pin, SM10B-GHS-TB) for an optional small SPI display: SCK/MOSI/MISO/CS on GPIO 12/11/13/10, DC GPIO9, RST GPIO14, backlight GPIO18, plus 3.3 V, 5 V and GND. No on-board I/O protection — internal short cable only.

- **Reach:** Connector **U10** (10-pin JST-GH)
- **Action:** plug in the display's GH cable (pin 1 = +3.3 V).
- **Needs:** physical access to the board; power off before plugging the cable
- **Expect:** Display powers from +3.3 V / +5 V with backlight on GPIO18 once firmware drives it; nothing is driven by default.
- **Source:** `MarineBoard/MarineBoard.kicad_sch` (U10) · MarineBoard/Technical Specs.md (§U10)
