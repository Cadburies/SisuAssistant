---
title: Marine Board › Tank loops & battery shunt
id: hw/marine-board/levels-shunt
kind: hardware
tags: 4-20ma tank level loops shunt ina226 u5 u6 u4 kelvin
status: live
script: levels-shunt.sh
image: MarineBoard/Documentation/LEVELS MONITOR.png, MarineBoard/Documentation/12V BATTERY MONITOR.png
order: 40
---
Two 12 V 4–20 mA tank-sender loops (**U5** LVL1, **U6** LVL2) and a Kelvin sense input for a 400 A / 75 mV battery shunt (**U4** SH−/SH+).

- **Reach:** Connectors **U5**, **U6** (loops) and **U4** (shunt sense)
- **Action:** wire 2-wire senders to LVL + 12 V; shunt sense as a twisted pair.
- **Needs:** physical access to the board; power off before wiring
- **Expect:** Loop current 4–20 mA maps to tank %; shunt reads house current.
- **Source:** MarineBoard/Technical Specs.md (§4–20 mA levels) · `MarineBoard/MarineBoard.kicad_sch`
