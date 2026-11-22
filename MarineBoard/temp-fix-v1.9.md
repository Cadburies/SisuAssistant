# v1.9 board — test-rig actions and accepted risks

Rule: [`AGENTS.md`](../AGENTS.md) rule 18. Read this before powering or wiring a v1.9 board.

**Authority:** this is the active v1.9 document. Board identity and manufacturing record: [`v1.9/README.md`](v1.9/README.md). Current design (v1.10, no board): [`Technical Specs.md`](Technical%20Specs.md). Future corrections in the current spec's [§ Next spin](Technical%20Specs.md#next-spin--decided-changes-not-fitted-on-v19) are **not fitted on v1.9**.

## Which boards this covers

The five boards from PCBWay order **`W831004AS1P18`** are the **post-#183 v1.9 build**; the silk reads **v1.9**. The archived v1.9 production gerbers are byte-identical in copper to the current **v1.10** source (`dfd3adb8…`), but **no v1.10 board is in production yet**. The v1.9 archive BOM already has the 50 V caps, polymer C20, D17/D21, and no C10/C21/C22/C23/R13.

Therefore **do not perform the old v1.00/#183 reworks**:

- Do **not** lift U3 pin 5 (ENA is already floating).
- Do **not** bridge C10; it is already removed and INA226 VBUS is tied to Vin+.
- Do **not** replace C11/C12/C14/C19/C42/C33; they are 50 V parts.
- Do **not** change the C20/buck network; the add-on network is already absent.
- Do **not** move U23 VDD; it is already on protected `+12V`.
- Do **not** add D17/D21, move CAN, or add TP1–TP6; they are fitted.

These boards are alternator-controller test units. The field-fail-on risk (#238) is **accepted** because the operator has a hard controller-power breaker and a hard field switch. No watchdog or fail-off rework is required or present.

## Do before the first 12 V / field connection

| Action | Why / limit |
| --- | --- |
| **Fuse the 12 V feed externally; fit a load-dump TVS across +12 V at CN1** — SM8S18CAHE3 / SM8S18CA class, bidirectional, short leads to battery negative. | D6 (SMBJ18A) is after F1/D14; CN1, CN2, D8, C42 and U16 see the surge first (#239). The TVS is a pulse clamp, not a regulator; it does not fix U23's 20 V or Q2/Q3's 25 V ratings. |
| **No reverse polarity.** Use a keyed connector and check polarity before every connection. | CN1 is upstream of D14; a reversed battery puts −12 V on CN2, D8, C42 and U16. The bidirectional TVS does not conduct at −12 V. |
| **Keep total CN1 + CN2 load below 10 A**, and thermal-check the connector after a loaded run. Add an external load-side fuse sized to the field coil and cable. | CN1/CN2 and F3 are at their thermal margin (#245). The field path is ~10 A continuous; if the alternator field is near that, the board is the wrong switch. |
| **ENBL: drive it from 3.3 V, or add an external 1.5–2.2 kΩ series resistor** in the field-side ENBL line. Never apply raw 12 V through the on-board 1 kΩ R22. | R22 is a 0402 running at 2–3× its power rating at 12 V (#230). A 2.2 kΩ external resistor drops it to ~3.4 mA / ~12 mW in R22; the PC817 still switches. |
| **Do not disconnect the battery/charge path while the field is energized.** If the hard field switch or controller breaker can open under field current, fit a freewheel diode across the field coil (cathode to +12 V) and use a DC-rated switch. | The on-board D8 only clamps while it remains connected. Opening the field path or the battery under excitation is a load-dump event and can take out the switch, D8, U23 or Q4. |
| **First power from a current-limited bench supply, no field, no loops, no relay load.** Verify 3.3 V and 5 V rails under a light load, then connect sensors. | The TPS5430 has no battery UVLO (#240); its own UVLO is only 5.3–5.5 V. Keep the bank above 9 V and set the BMS cutoff. The buck compensation is the correct internal-comp design, but still validate the rail (#243). |
| **Use a protected/current-limited USB source and avoid hot-plugging.** | No VBUS ESD clamp (#242). USB is data/flash only; 12 V is required for field, relay and loops. |

## Only if you wire these in the test

| Circuit | Action |
| --- | --- |
| **4–20 mA level loops (LVL1/LVL2)** | Per loop: **50–100 mA PPTC/fuse**, series Schottky, and **SMBJ15A** at the connector. Verify polarity every time. Reverse 12 V destroys the INA226; a short puts ~7.4 W in R35 and F1 never clears (#237/#250). For alternator-only tests, leave both loops disconnected. |
| **Relay output** | External **5 A fuse** and an RC snubber at the load; keep the load under 5 A (#241). |
| **CN3 / CN4 / U9 3.3 V outlets** | Inline **100–500 mA fuse/PPTC** per used run (#246). CN4 has no series resistor, ESD clamp or pull; 3.3 V logic only, short in-enclosure cable, never off-board. |
| **CAN / NMEA 2000** | Shield bonded at one end only; JP1 termination only if this node is a bus end (#244). |
| **RPM input** | Use only a **phase-lead tap** through the on-board C39/R16 front end; do not improvise a tap on a raw winding outside that design basis. Bench-verify clean pulses idle→max RPM (#26). |
| **Recovery** | There are no UART0 test pads (#247). Keep USB-C recovery and a known-good image. |

## Exposures vs future corrections

A next-spin correction is not present on v1.9. Use this matrix to separate what the physical board has from what the future board is planned to fix.

| Exposure | v1.9 action | Future correction |
|---|---|---|
| **#238 field drive can fail on** | Accepted by the operator: hard controller-power breaker + hard field switch | #238 watchdog/ENBL **not fitted on v1.9** |
| **#239 load dump reaches CN1/CN2/U16** | External TVS at CN1; no battery disconnect under field; no deliberate load dump | #239 inlet clamp **not fitted on v1.9** |
| **#230 ENBL R22 dissipation** | External 1.5–2.2 kΩ series resistor; never raw 12 V through R22 | No next-spin change recorded; the v1.9 action still applies |
| **#237 4–20 mA loops** | Leave disconnected for alternator-only tests; if wired, external PPTC + Schottky + SMBJ15A per loop | #237 loop protection **not fitted on v1.9** |
| **#240 no battery UVLO** | BMS/battery cutoff; keep the bank above 9 V; bench-validate the start threshold | #240 ENA divider **not fitted on v1.9** |
| **#245 CN1/CN2 thermal margin** | Total CN1 + CN2 load below 10 A; external load-side fuse; thermal-check after a loaded run | No next-spin change recorded; the v1.9 action still applies |

The detailed rows below are the operative v1.9 instructions. Future-board changes and their rationale stay in the current spec's [§ Next spin](Technical%20Specs.md#next-spin--decided-changes-not-fitted-on-v19).

## Accepted residual risks

| Risk | Mitigation |
| --- | --- |
| **#238 field drive can fail on** (shorted U16/U23/Q4 or hung firmware) | Accepted by the operator: hard controller-power breaker plus hard field switch. The board itself has no watchdog, gate monitor or hardware fail-off. Do not rely on firmware to clear it. |
| **#239 U23 MCP1407 (20 V abs max) and Q2/Q3 (25 V VCEO)** | External TVS limits exposure; it does not change the ratings. No 24 V systems, no battery disconnect under field, no deliberate load-dump test. |
| **#240 no TPS5430 battery UVLO** | BMS/battery cutoff; keep the bank above 9 V; bench-validate the start threshold. |
| **#243 3.3 V buck passives** | Correct v1.9 network is fitted; validate the rail under load and temperature before each board enters service. |
| **#247 no UART0 pads** | USB-C recovery; do not change the bootloader in the field. |

Source: `Documentation/findings-report.md`, the 2026-11-20 netlist review, issues #230, #237–#250, and the v1.9 production package.
