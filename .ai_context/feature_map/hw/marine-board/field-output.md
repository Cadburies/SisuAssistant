---
title: Marine Board › Field PWM output (CN2)
id: hw/marine-board/field-output
kind: hardware
tags: pwm field output cn2 mosfet fuse f3 alternator drive
status: live
script: field-output.sh
---
Low-side PWM drive for the alternator field on **CN2** (+12V BAT, PWM1), fused by F3 (15 A class), ~10 A continuous (copper-limited).

- **Reach:** Connector **CN2**
- **Action:** wire the field winding between +12V BAT and PWM1; add load-side fusing for inductive loads.
- **Needs:** physical access to the board; power off before wiring
- **Expect:** Field duty follows the controller; 0 % in Shadow. Spec text lists older driver/MOSFET parts (#173).
- **Source:** MarineBoard/Technical Specs.md (§PWM output) · `MarineBoard/MarineBoard.kicad_sch`
