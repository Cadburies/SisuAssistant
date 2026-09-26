---
title: Marine Board › Isolated inputs (U13)
id: hw/marine-board/inputs
kind: hardware
tags: inputs enbl rpm tmp1 temperature ds18b20 opto isolated u13
status: live
script: inputs.sh
---
Opto-isolated **ENBL** and **RPM** inputs and the **TMP1** 1-Wire temperature probe on connector **U13**.

- **Reach:** Connector **U13** (ENBL, RPM, TMP1)
- **Action:** ENBL = enable signal (off→on also clears a latched fault); RPM from the alternator tap; TMP1 = DS18B20 probe.
- **Needs:** physical access to the board; power off before wiring
- **Expect:** ENBL/RPM show in HA/web page; temperature reads within a second of boot.
- **Source:** MarineBoard/Technical Specs.md (§Digital / sensor inputs) · `MarineBoard/MarineBoard.kicad_sch`
