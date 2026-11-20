# v1.9 board — temp fixes and risks

Rule: [`AGENTS.md`](../AGENTS.md) rule 18. Read this before powering or wiring a v1.9 / v1.9.1 board.

Every fault that can break or damage a v1.9 board has a row. Prefer a fix that needs **no soldering** (inline fuse/PTC, external clamp, wiring, firmware/config). When only a board rework fixes it, the row states the **risk** and the operating **mitigation** instead. Add or update the row in the same change as the issue or the fix.

Source: `Documentation/findings-report.md`, the 2026-11-20 netlist review, and issues #230, #237–#250. Last updated 2026-11-20.

| Issue | Fault | Solderless temp fix | Risk if only solder fixes it — mitigation |
| --- | --- | --- | --- |
| #248 | ERC cleanup only (WS2812 pin type, GND flag, +5V naming) | None needed — schematic-only, netlist identical, no copper change. | No board risk. |
| #250 | 4–20 mA loop has no series fuse; `R35`/`R36` 10 Ω + `R38`/`R39` 3.9 Ω are 0805 0.125 W class | Fit a **50–100 mA PPTC or fuse in series with each loop** at the connector. 20 mA is the maximum normal current. | A sustained loop short puts ~7.4 W in R35 and ~2.9 W in R38; a shunt short puts ~14 W in R35. The parts overheat. With no fuse, treat the loop wiring as unprotected and isolate it before work. |
| #237 | 4–20 mA loop has no current limit or reverse protection | 50–100 mA fuse/PPTC per loop plus a series Schottky diode and a TVS at LVL1/LVL2, or verify polarity before every connection. | Reverse 12 V destroys the INA226; a shunt short leaves only R35. Fit the fuse, diode and TVS; label loop polarity. Next spin uses 1206L010/60WR + SS14 + SMBJ15A (`Technical Specs.md` *Next spin*). |
| #238 | Field drive can fail on: a shorted U16 opto output pulls the MCP1407 input high; U16's collector is ahead of F1 | No solderless fix. Keep `switch.shadow_sw` ON and the field wire off; use an external relay or disconnect. | A shorted FET or opto holds the alternator field on → overcharge/overheat. The next spin adds a watchdog/ENBL hardware enable and a gate monitor (`Technical Specs.md` *Next spin*); v1.9.1 has none. Do not fit the field wire until fail-off is proven; supervised tests only. |
| #239 | Raw +12 V is clamped only after F1/D14 (D6 SMBJ18A, 600 W); the raw inlet, CN2, D8 and U16 have no clamp | Fused 12 V feed plus an external **load-dump** TVS at the battery input/connector (SM8S18CAHE3 class, bidirectional), short leads to the battery negative. | A load dump can destroy D6/regulators. A 29.2 V clamp is also above **U23 MCP1407 (20 V abs max)** and **Q2/Q3 S8050 (25 V VCEO)**, so the field driver and the relay/buzzer drivers are exposed. Keep the field wire off and do not run a v1.9.1 board into a load dump; next spin replaces U23 and Q2/Q3 (see `Technical Specs.md` *Next spin*). |
| #240 | TPS5430 has no battery UVLO divider | No solderless fix. Use the BMS/battery cutoff and keep the bank above 9 V. | The converter can start or run on a deeply discharged battery. Set the BMS cutoff; do not start on a flat bank. |
| #241 | Relay contact fuse is 10 A and there is no arc suppression | External **5 A fuse** and an RC snubber at the load terminals. | Contact welding/arcing on an inductive load. Fuse and snub the load; keep it under 5 A. |
| #242 | USB-C VBUS inrush and no VBUS ESD clamp | Use a current-limited/protected USB source; avoid hot-plugging. | Connector or host damage. Use a protected source; this is not a vessel-critical path. |
| #243 | 3.3 V buck passives miss the app note | No solderless fix. Bench-validate the 3.3 V rail and keep its load low. | Instability/ripple over temperature. Validate at load; replace the passives in the next revision. |
| #244 | CAN isolation and shield path are undecided | Single-point shield, short N2K drop, isolated adapter if a ground loop appears. | Ground loop/noise. Tie the shield at one end only; do not bond both ends. |
| #245 | CN1/CN2 connector and fuse margin at 10 A | External 10 A fuse; keep the total load below 10 A. | Connector heating at the margin. Thermal-check after load; derate. |
| #246 | 3.3 V outlets CN3, CN4, U9 are unfused | Inline 100–500 mA fuse/PPTC on each outlet run. | A short burns the trace/connector. Fuse each run. |
| #247 | No UART0 test pads | No solderless fix. Keep USB-C recovery and a known-good image. | A bricked boot needs soldering to the pads. Keep USB access; avoid bootloader changes in the field. |
| #230 | `R22` 1 kΩ 0402 on ENBL runs at 2–3× its power rating on 12 V | No on-board solderless fix. Drive ENBL from 3.3 V, or add an external series resistor/divider. | R22 dissipates ~144 mW vs a ~62.5 mW 0402 rating; drift/failure. Use a 3.3 V drive or external resistor. |
