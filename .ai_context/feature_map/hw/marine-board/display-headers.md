---
title: Marine Board › Display header (CN4)
id: hw/marine-board/display-headers
kind: hardware
tags: display spi tft header cn4 jst gh bm10b vertical backlight gpio
status: live
script: display-headers.sh
image: MarineBoard/Documentation/HEADER PINS.png
order: 60
---
Connector **CN4** (JST-GH 10-pin, vertical BM10B-GHS-TBT, top side; was U10 on v1.8) for an optional small SPI display: SCK/MOSI/MISO/CS on GPIO 12/11/13/10, DC GPIO9, RST GPIO14, backlight GPIO18, plus 3.3 V, 5 V and GND. No on-board I/O protection — internal short cable only.

- **Reach:** Connector **CN4** (10-pin vertical JST-GH, below the Reset/Flash buttons)
- **Action:** plug in the display's GH cable (pin 1 = +3.3 V).
- **Needs:** physical access to the board; power off before plugging the cable
- **Expect:** Display powers from +3.3 V / +5 V with backlight on GPIO18 once firmware drives it; nothing is driven by default.
- **Source:** `MarineBoard/MarineBoard.kicad_sch` (CN4) · MarineBoard/Technical Specs.md (§CN4)
