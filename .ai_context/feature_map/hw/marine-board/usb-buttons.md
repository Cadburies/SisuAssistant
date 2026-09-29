---
title: Marine Board › USB-C, Reset & Boot
id: hw/marine-board/usb-buttons
kind: hardware
tags: usb-c programming flash reset boot button serial
status: live
script: usb-buttons.sh
image: MarineBoard/Documentation/LEDS & BUTTONS & BUZZER.png
order: 70
---
USB-C (**J1**) for flashing, serial logs and 5 V logic power; **Reset** and **Boot** buttons for recovery.

- **Reach:** Connector **J1** and the two push buttons
- **Action:** hold **Boot**, tap **Reset** to enter download mode; flash with ESPHome.
- **Needs:** physical access to the board; power off before wiring
- **Expect:** Board enumerates as a USB serial device; logs stream at boot. RGB status LED (D5): alternators blue idle / green charging / amber warning / red fault / purple shadow; levels green flash = OK, blue = HA API down; freezer cyan = compressor on. **Status LED brightness** number in HA. Schematic shown: status LEDs, Reset/Boot buttons and buzzer.
- **Source:** MarineBoard/Technical Specs.md (§Microcontroller Module) · `MarineBoard/MarineBoard.kicad_sch`
