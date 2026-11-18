"""Net table for the fridge daughter board first draft (#229).

Read by MarineBoard/kicad-skills/scripts/draft_sch.py. Each part:
    (ref, "Lib:Symbol", value, footprint, (x, y) in mm on the sheet, {pin number: net or None})
None = no-connect flag. Refs starting with # are power flags. A symbol with a second
unit (power pins) gets that unit drawn 30.48 mm to the right.

After the owner's first hand edit in KiCad, the .kicad_sch is the source and this file
is deleted (MarineBoard/daughter-fridge/technical spec.md, section 10).
"""

PAPER = "A3"
TITLE = {
    "title": "Sisu fridge daughter board",
    "date": "2026-11-15",
    "rev": "0.1 draft",
    "company": "Sisu",
    "comment 1": "National Luna Weekender, Danfoss BD35F / 101N0500",
    "comment 2": "First draft generated from draft_nets.py. Not reviewed.",
}

R0805 = "Resistor_SMD:R_0805_2012Metric"
C0805 = "Capacitor_SMD:C_0805_2012Metric"
TB3 = "LCSC:CONN-TH_3P-P3.50_L7.4-W10.5"
TB2 = "LCSC:CONN-TH_2P-P3.50_L7.4-W7.0"
SOP4 = "Package_SO:SOP-4_3.8x4.1mm_P2.54mm"

# ref, lib:symbol, value, footprint, (x, y), {pin: net}, extra fields
PARTS = [
    # --- CN4 link to the Marine Board ---
    ("J1", "Connector_Generic:Conn_01x10", "BM10B-GHS-TBT", "LCSC:CONN-SMD_BM10B-GHS-TBT-LF-SN", (45.72, 76.2),
     {"1": "+3.3V", "2": "GND", "3": "SPD_2500_N", "4": "SPD_2000_N", "5": "SPD_3000_N",
      "6": "STOP_N", "7": "OW2", "8": "FAULT_N", "9": "HEARTBEAT", "10": None}),

    # --- Watchdog ---
    ("U2", "74xGxx:74LVC1G123", "74LVC1G123DP", "Package_SO:TSSOP-8_3x3mm_P0.65mm", (114.3, 76.2),
     {"1": "GND", "2": "HEARTBEAT", "3": "+3.3V", "5": "WDOG_OK", "6": "WD_CEXT", "7": "WD_RCEXT",
      "4": "GND", "8": "+3.3V"}),
    ("R20", "Device:R", "470k 1%", R0805, (88.9, 50.8), {"1": "WD_RCEXT", "2": "+3.3V"}),
    ("C20", "Device:C", "4.7uF X7R 16V", C0805, (101.6, 50.8), {"1": "WD_CEXT", "2": "WD_RCEXT"}),
    ("R21", "Device:R", "100k", R0805, (88.9, 101.6), {"1": "GND", "2": "HEARTBEAT"}),
    ("C21", "Device:C", "100nF", C0805, (167.64, 76.2), {"1": "GND", "2": "+3.3V"}),

    # --- Speed and stop relays (LED supply = WDOG_OK, GPIO open drain pulls low = on) ---
    ("K1", "Relay_SolidState:CPC1017N", "CPC1017N", SOP4, (213.36, 50.8),
     {"1": "WDOG_OK", "2": "K1_LED", "3": "DANFOSS_C", "4": "LOOP_3"}),
    ("K2", "Relay_SolidState:CPC1017N", "CPC1017N", SOP4, (213.36, 78.74),
     {"1": "WDOG_OK", "2": "K2_LED", "3": "LOOP_1", "4": "LOOP_3"}),
    ("K3", "Relay_SolidState:CPC1017N", "CPC1017N", SOP4, (213.36, 106.68),
     {"1": "WDOG_OK", "2": "K3_LED", "3": "LOOP_2", "4": "LOOP_3"}),
    ("K4", "Relay_SolidState:CPC1117N", "CPC1117N", SOP4, (213.36, 134.62),
     {"1": "WDOG_OK", "2": "K4_LED", "3": "LOOP_3", "4": "LOOP_4"}),
    ("R11", "Device:R", "470", R0805, (187.96, 50.8), {"1": "SPD_2000_N", "2": "K1_LED"}),
    ("R12", "Device:R", "470", R0805, (187.96, 78.74), {"1": "SPD_2500_N", "2": "K2_LED"}),
    ("R13", "Device:R", "470", R0805, (187.96, 106.68), {"1": "SPD_3000_N", "2": "K3_LED"}),
    ("R14", "Device:R", "470", R0805, (187.96, 134.62), {"1": "STOP_N", "2": "K4_LED"}),

    # --- Speed ladder, battery level, loop protection ---
    ("R1", "Device:R", "280 1%", R0805, (269.24, 50.8), {"1": "LOOP_1", "2": "DANFOSS_C"}),
    ("R2", "Device:R", "412 1%", R0805, (269.24, 81.28), {"1": "LOOP_2", "2": "LOOP_1"}),
    ("R3", "Device:R", "825 1%", R0805, (269.24, 111.76), {"1": "LOOP_3", "2": "LOOP_2"}),
    ("JP1", "Jumper:SolderJumper_2_Bridged", "LOOP", "Jumper:SolderJumper-2_P1.3mm_Bridged_RoundedPad1.0x1.5mm",
     (269.24, 142.24), {"1": "LOOP_4", "2": "DANFOSS_T"}),
    ("R4", "Device:R", "0", R0805, (297.18, 50.8), {"1": "DANFOSS_P", "2": "DANFOSS_C"}),
    ("D2", "Device:D_TVS", "SMAJ33CA (value after M1)", "Diode_SMD:D_SMA", (304.8, 111.76),
     {"1": "DANFOSS_C", "2": "DANFOSS_T"}),

    # --- Terminals, loop side ---
    ("J2", "Connector_Generic:Conn_01x03", "DANFOSS + D C", TB3, (342.9, 50.8),
     {"1": "DANFOSS_PLUS", "2": "DANFOSS_D", "3": "DANFOSS_C"}),
    ("J3", "Connector_Generic:Conn_01x02", "DANFOSS P T", TB2, (342.9, 76.2),
     {"1": "DANFOSS_P", "2": "DANFOSS_T"}),
    ("J4", "Connector_Generic:Conn_01x02", "RLY (service break)", TB2, (342.9, 99.06),
     {"1": "LOOP_4", "2": "DANFOSS_T"}),

    # --- Danfoss fault LED input ---
    ("R16", "Device:R", "1k 1206 (value after M4)", "Resistor_SMD:R_1206_3216Metric", (269.24, 182.88),
     {"1": "FLT_A", "2": "DANFOSS_PLUS"}),
    ("D1", "Device:D", "1N4148W", "Diode_SMD:D_SOD-123", (243.84, 200.66), {"1": "FLT_A", "2": "DANFOSS_D"}),
    ("U1", "Isolator:PC817", "PC817C-S", "LCSC:SOP-4_L6.5-W4.6-P2.54-LS10.3-TL", (213.36, 182.88),
     {"1": "FLT_A", "2": "DANFOSS_D", "3": "GND", "4": "FAULT_N"}),
    ("R15", "Device:R", "10k", R0805, (187.96, 182.88), {"1": "FAULT_N", "2": "+3.3V"}),

    # --- Second 1-Wire bus, two probes ---
    ("R30", "Device:R", "120", R0805, (63.5, 172.72), {"1": "OW2_EXT", "2": "OW2"}),
    ("R31", "Device:R", "4.7k", R0805, (78.74, 172.72), {"1": "OW2_EXT", "2": "+3.3V"}),
    ("D3", "Device:D_Zener", "ESD5Z3.3T1G", "Diode_SMD:D_SOD-523", (93.98, 190.5), {"1": "OW2_EXT", "2": "GND"}),
    ("F1", "Device:Polyfuse", "0.1A hold", "Fuse:Fuse_1206_3216Metric", (109.22, 172.72),
     {"1": "PROBE_3V3", "2": "+3.3V"}),
    ("J5", "Connector_Generic:Conn_01x03", "PROBE A (3V3 DQ GND)", TB3, (139.7, 165.1),
     {"1": "PROBE_3V3", "2": "OW2_EXT", "3": "GND"}),
    ("J6", "Connector_Generic:Conn_01x03", "PROBE B (3V3 DQ GND)", TB3, (139.7, 190.5),
     {"1": "PROBE_3V3", "2": "OW2_EXT", "3": "GND"}),

    # --- Power flags, test pads, holes ---
    ("#FLG01", "power:PWR_FLAG", "PWR_FLAG", "", (45.72, 228.6), {"1": "+3.3V"}),
    ("#FLG02", "power:PWR_FLAG", "PWR_FLAG", "", (60.96, 228.6), {"1": "GND"}),
    ("TP1", "Connector:TestPoint", "GND", "TestPoint:TestPoint_Pad_D1.5mm", (88.9, 228.6), {"1": "GND"}),
    ("TP2", "Connector:TestPoint", "+3.3V", "TestPoint:TestPoint_Pad_D1.5mm", (104.14, 228.6), {"1": "+3.3V"}),
    ("TP3", "Connector:TestPoint", "WDOG_OK", "TestPoint:TestPoint_Pad_D1.5mm", (119.38, 228.6), {"1": "WDOG_OK"}),
    ("TP4", "Connector:TestPoint", "LOOP C", "TestPoint:TestPoint_Pad_D1.5mm", (134.62, 228.6), {"1": "DANFOSS_C"}),
    ("TP5", "Connector:TestPoint", "LOOP T", "TestPoint:TestPoint_Pad_D1.5mm", (149.86, 228.6), {"1": "DANFOSS_T"}),
    ("H1", "Mechanical:MountingHole", "M3", "MountingHole:MountingHole_3.2mm_M3", (180.34, 228.6), {}),
    ("H2", "Mechanical:MountingHole", "M3", "MountingHole:MountingHole_3.2mm_M3", (190.5, 228.6), {}),
    ("H3", "Mechanical:MountingHole", "M3", "MountingHole:MountingHole_3.2mm_M3", (200.66, 228.6), {}),
    ("H4", "Mechanical:MountingHole", "M3", "MountingHole:MountingHole_3.2mm_M3", (210.82, 228.6), {}),
]

NOTES = [
    ((25.4, 17.78), "CN4 LINK\nJST GH 10-pin, 1:1, <= 150 mm,\ninside the box.\nCheck pin 1 to pin 1."),
    ((76.2, 17.78), "WATCHDOG\nEach HEARTBEAT rising edge holds\nWDOG_OK high ~2 s (R20 x C20, confirm).\nNo heartbeat = no relay LED supply\n= 3,500 rpm."),
    ((175.26, 17.78), "SPEED + STOP\nGPIO open drain, low = LED on.\nK1 2,000 | K2 2,500 | K3 3,000 rpm\nnone on = 3,500 rpm\nK4 normally closed: on = stop."),
    ((256.54, 17.78), "LOOP SIDE\n1.5 mm from logic (kicad_dru), no GND pour.\nC - R1 - R2 - R3 - K4 - JP1 - T\nJP1 ships closed. J4 = service break."),
    ((175.26, 154.94), "FAULT INPUT\nDanfoss + and D, both ends floating.\nR16 at + limits a board fault to ~15 mA.\nFAULT_N low = lit."),
    ((25.4, 142.24), "PROBES\nSecond 1-Wire bus on GPIO9,\ntwo DS18B20, supply through F1."),
    ((25.4, 210.82), "DRAFT 0.1 (#229). Generated from the net table,\nnot reviewed. Parts to confirm: technical spec.md 6.10."),
]
