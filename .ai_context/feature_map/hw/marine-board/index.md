---
title: Marine Board › Overview
id: hw/marine-board
kind: hardware
tags: marine board hardware esp32 pcb connectors overview
status: live
script: index.sh
image: MarineBoard/Documentation/ESP32 (new).png
---
Sisu Marine Board: ESP32-S3 controller with 12 V input, field PWM output, relay, CAN, isolated inputs, two 4–20 mA loops, shunt monitor and USB-C.

- **Reach:** The board in its enclosure (engine room / saloon); spec in the MarineBoard folder
- **Action:** connect field wiring to the labelled connectors below.
- **Needs:** physical access to the board; power off before wiring
- **Expect:** Logic rail LED on with 12 V or USB; web page answers once on Wi-Fi. Schematic: ESP32-S3 module and GPIO map (C24/C25 have since moved to the ESP32 side of L7).
- **Source:** MarineBoard/Technical Specs.md (§Overview) · `MarineBoard/MarineBoard.kicad_sch`
