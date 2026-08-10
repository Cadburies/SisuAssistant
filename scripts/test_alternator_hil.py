#!/usr/bin/env python3
"""Hardware-in-the-loop (HIL) test suite for marine_alternator.yaml's control
logic, run against the real, currently-flashed firmware on the LilyGo T8-S3
lab test rig (homeassistant/esphome/test_rig.yaml @ 192.168.10.48, issue #23).

This does NOT test a simulator -- test_rig.yaml runs the actual cascaded
PI + charge-state-machine + fail-safe logic (a hand-synced mirror of
packages/marine_alternator.yaml), driven by manually-injected static sensor
values instead of a real alternator. See issue #28.

Talks to the device's own `web_server:` REST API directly via
scripts/esphome_web_client.py, NOT through Home Assistant -- see that
module's docstring and issue #29 for why (HA's entity registry for this
device is known-incomplete; the device itself is ground truth).

Run from HA Green's host shell (only vantage point that can reach the
Sisu-IoT VLAN):
    ./scripts/ha-scp.sh scripts/esphome_web_client.py /tmp/esphome_web_client.py
    ./scripts/ha-scp.sh scripts/test_alternator_hil.py /tmp/test_alternator_hil.py
    ./scripts/ha-ssh.sh 'python3 /tmp/test_alternator_hil.py --host 192.168.10.48'

Exits 0 if every scenario passed, 1 otherwise. Always restores the rig to a
known default/safe state on exit (finally-block), even on failure or
Ctrl-C, since this rig is shared bench equipment.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from dataclasses import dataclass

sys.path.insert(0, "/tmp")  # esphome_web_client.py lands alongside this file on HA Green
try:
    from esphome_web_client import ESPHomeWebClient
except ImportError:
    from scripts.esphome_web_client import ESPHomeWebClient  # local/dev fallback


TICK_S = 0.25  # matches the firmware's `interval: 250ms` control loop
SETTLE_S = 1.2  # comfortably clears the field-duty sensor's 1s publish interval + SSH-relay latency


@dataclass
class Result:
    name: str
    passed: bool
    detail: str
    skipped: bool = False


@dataclass
class Side:
    """Entity-name plumbing for one side (Port/Starboard) of the rig."""
    label: str  # "Port" | "Starboard"

    def n(self, base: str) -> str:
        return f"{base} · {self.label}"  # "·" = the middle-dot ESPHome uses


class Rig:
    """High-level control/observation helpers for one side of the test rig."""

    def __init__(self, client: ESPHomeWebClient, side: Side):
        self.c = client
        self.s = side

    # ---- injected raw sensor values ----
    def inject(self, house_v=None, alt_i=None, alt_t=None, rpm=None):
        if house_v is not None:
            self.c.set_number(self.s.n("House Voltage (Injected)"), house_v)
        if alt_i is not None:
            self.c.set_number(self.s.n("Alternator Current (Injected)"), alt_i)
        if alt_t is not None:
            self.c.set_number(self.s.n("Alternator Temperature (Injected)"), alt_t)
        if rpm is not None:
            self.c.set_number(self.s.n("Alternator RPM (Injected)"), rpm)

    # ---- setpoints ----
    def set_i_sp(self, v): self.c.set_number(self.s.n("Alternator Current Setpoint"), v)
    def set_t_sp(self, v): self.c.set_number(self.s.n("Alternator Temperature Setpoint"), v)
    def set_float_v(self, v): self.c.set_number(self.s.n("House Float Voltage"), v)
    def set_abs_v(self, v): self.c.set_number(self.s.n("House Absorption Voltage"), v)
    def set_charged_v(self, v): self.c.set_number(self.s.n("House Charged Voltage"), v)
    def set_bank_ah(self, v): self.c.set_number(self.s.n("BMS Bank Capacity"), v)
    def set_tail_pct(self, v): self.c.set_number(self.s.n("BMS Tail Current"), v)
    def set_charged_detect_s(self, v): self.c.set_number(self.s.n("BMS Charged Detection Time"), v)
    def set_abs_max_min(self, v): self.c.set_number(self.s.n("Absorption Max Time"), v)
    def set_rpm_gate(self, v): self.c.set_number(self.s.n("Alternator RPM Gate"), v)

    # ---- switches ----
    def enable(self, on: bool): self.c.set_switch(self.s.n("Alternator Enable"), on)
    def fail_house_v(self, on: bool): self.c.set_switch(self.s.n("Fail House Voltage Sensor"), on)
    def fail_alt_i(self, on: bool): self.c.set_switch(self.s.n("Fail Alternator Current Sensor"), on)
    def fail_alt_t(self, on: bool): self.c.set_switch(self.s.n("Fail Alternator Temperature Sensor"), on)
    def fail_rpm(self, on: bool): self.c.set_switch(self.s.n("Fail Alternator RPM Sensor"), on)

    # ---- observation ----
    def field_pct(self) -> float:
        return self.c.get_value("sensor", self.s.n("Alternator Field Duty"))

    def stage(self) -> str:
        return self.c.get_value("text_sensor", self.s.n("Alternator Charge Stage"))

    def status(self) -> str:
        return self.c.get_value("text_sensor", self.s.n("Alternator Status"))

    @staticmethod
    def _truthy(v) -> bool:
        """binary_sensor/switch 'value' comes back as a native JSON bool
        (True/False) from a correctly-fixed client; tolerate an "ON"/"OFF"
        string too in case a caller passes 'state' instead of 'value'."""
        if isinstance(v, bool):
            return v
        return str(v).upper() in ("ON", "TRUE", "1")

    def alarm(self) -> bool:
        return self._truthy(self.c.get_value("binary_sensor", self.s.n("Alarm Active")))

    def warning(self) -> bool:
        return self._truthy(self.c.get_value("binary_sensor", self.s.n("Warning Active")))

    def status_field(self, key: str) -> float | None:
        """Parse a `key=NN.N` token out of the free-text Alternator Status
        message (e.g. "lim 117.9") -- the only way to see internal values
        (thermal_current_limit, target_current) this old firmware build
        doesn't expose as their own entities."""
        m = re.search(rf"{re.escape(key)}\s*([-\d.]+)", self.status())
        return float(m.group(1)) if m else None

    def reset_defaults(self):
        self.enable(False)
        time.sleep(SETTLE_S)
        self.fail_house_v(False)
        self.fail_alt_i(False)
        self.fail_alt_t(False)
        self.fail_rpm(False)
        self.set_i_sp(150)
        self.set_t_sp(95)
        self.set_float_v(13.5)
        self.set_abs_v(14.3)
        self.set_charged_v(14.3)
        self.set_bank_ah(1500)
        self.set_tail_pct(5.0)
        self.set_charged_detect_s(180)
        self.set_abs_max_min(120)
        self.set_rpm_gate(0)
        self.inject(house_v=12.50, alt_i=80, alt_t=45, rpm=1200)
        time.sleep(SETTLE_S)
        self.enable(True)
        time.sleep(SETTLE_S)


class Suite:
    def __init__(self, rig: Rig, results: list[Result]):
        self.r = rig
        self.results = results

    def check(self, name: str, cond: bool, detail: str):
        self.results.append(Result(name, cond, detail))
        mark = "PASS" if cond else "FAIL"
        print(f"  [{mark}] {name} -- {detail}")

    def skip(self, name: str, detail: str):
        self.results.append(Result(name, True, detail, skipped=True))
        print(f"  [SKIP] {name} -- {detail}")

    # =====================================================================
    # A. Normal operation at default setpoints
    # =====================================================================
    def a1_bulk_default(self):
        self.r.reset_defaults()
        st, al, wa, fd = self.r.stage(), self.r.alarm(), self.r.warning(), self.r.field_pct()
        self.check(
            "A1 default bulk, no alarm/warning",
            st == "bulk" and not al and not wa and fd == fd,  # fd==fd rejects NaN
            f"stage={st} alarm={al} warning={wa} field={fd}",
        )

    def a2_bulk_to_absorption_boundary(self):
        # absorption_v(14.30) - V_BAND(0.03) = 14.27 exactly
        self.r.inject(house_v=14.26)
        time.sleep(SETTLE_S)
        st_below = self.r.stage()
        self.r.inject(house_v=14.28)
        time.sleep(SETTLE_S)
        st_above = self.r.stage()
        self.check(
            "A2 bulk->absorption boundary at abs_v - V_BAND",
            st_below == "bulk" and st_above == "absorption",
            f"14.26V -> {st_below}, 14.28V -> {st_above} (expected bulk, absorption)",
        )

    def a3_absorption_to_float_via_tail_current(self):
        # Shorten the detect timer for a bench-practical wait; restored after.
        self.r.set_charged_detect_s(30)
        self.r.inject(house_v=14.30, alt_i=50)  # 50A <= 1500Ah*5% = 75A tail threshold
        ok, last = self.r.c.wait_until(
            "text_sensor", self.r.s.n("Alternator Charge Stage"),
            lambda v: v == "float", timeout_s=40, poll_s=2.0,
        )
        self.check(
            "A3 absorption->float via tail-current + charged-detect timer",
            ok, f"stage after <=40s wait: {last} (expected float)",
        )
        self.r.set_charged_detect_s(180)  # restore production default

    def a4_float_rebulk_hysteresis(self):
        # Currently in float (from a3). float_v=13.5, REBULK_HYST=0.10 -> 13.40.
        self.r.inject(house_v=13.45)  # above hysteresis floor
        time.sleep(SETTLE_S)
        st_hold = self.r.stage()
        self.r.inject(house_v=13.35)  # below hysteresis floor
        time.sleep(SETTLE_S)
        st_rebulk = self.r.stage()
        self.check(
            "A4 float holds above hysteresis, rebulks below it",
            st_hold == "float" and st_rebulk == "bulk",
            f"13.45V -> {st_hold}, 13.35V -> {st_rebulk} (expected float, bulk)",
        )

    def a5_temp_in_bounds_no_warning_throughout(self):
        # alt_t held at 45C the whole time above; derate_start = 95-5=90.
        self.check(
            "A5 temp stayed well within bounds -> no warning at end of A-series",
            not self.r.warning(),
            f"warning={self.r.warning()} (alt_t=45C, derate_start=90C)",
        )

    # =====================================================================
    # B. Load switching on/off -- amps/volts reacting
    # =====================================================================
    def b2_current_step_up_field_trends_down(self):
        self.r.reset_defaults()  # bulk, i_sp=150
        self.r.inject(alt_i=80)
        time.sleep(2.2)
        f0 = self.r.field_pct()
        self.r.inject(alt_i=220)  # target(150) - 220 = -70, field should fall
        time.sleep(2.2)
        f1 = self.r.field_pct()
        self.check(
            "B2 current step up (load ON) -> field trends down",
            f1 < f0, f"field {f0:.2f}% -> {f1:.2f}% after current 80A->220A",
        )

    def b3_current_step_down_field_trends_up(self):
        self.r.inject(alt_i=40)  # target(150) - 40 = +110, field should rise
        time.sleep(2.2)
        f1 = self.r.field_pct()
        time.sleep(2.2)
        f2 = self.r.field_pct()
        self.check(
            "B3 current step down (load OFF) -> field trends up",
            f2 > f1 - 0.01, f"field {f1:.2f}% -> {f2:.2f}% after current held at 40A",
        )

    def b4_absorption_large_v_sag_stays_absorption(self):
        self.r.reset_defaults()
        self.r.inject(house_v=14.30, alt_i=80)
        time.sleep(SETTLE_S)
        assert self.r.stage() == "absorption", "precondition: must reach absorption first"
        self.r.inject(house_v=13.00)  # sudden sag, simulating a load switching ON
        time.sleep(SETTLE_S)
        st = self.r.stage()
        self.check(
            "B4 large voltage sag during absorption stays in absorption "
            "(CV loop compensates with current, no forced stage change)",
            st == "absorption", f"stage after sag = {st} (expected absorption)",
        )

    def b5_reverse_current_sanity_trip(self):
        self.r.reset_defaults()
        self.r.inject(alt_i=-6)  # below the -5A sanity floor
        time.sleep(SETTLE_S)
        al, fd, st = self.r.alarm(), self.r.field_pct(), self.r.stage()
        self.check(
            "B5 reverse-current sanity trip (<-5A) -> hard fault",
            al and fd == 0 and st == "off",
            f"alarm={al} field={fd} stage={st} (injected -6A)",
        )

    # =====================================================================
    # C. Live setpoint changes while operating
    # =====================================================================
    def c1_lower_current_sp_below_actual(self):
        self.r.reset_defaults()
        self.r.inject(alt_i=150)
        time.sleep(2.2)
        self.r.set_i_sp(100)  # target now < actual -> field should fall
        time.sleep(2.2)
        f1 = self.r.field_pct()
        time.sleep(2.2)
        f2 = self.r.field_pct()
        self.check(
            "C1 lower current SP below actual current -> field trends down",
            f2 <= f1 + 0.01, f"field {f1:.2f}% -> {f2:.2f}% after SP 150A->100A (actual 150A held)",
        )

    def c2_raise_current_sp_above_actual(self):
        self.r.set_i_sp(200)  # target now > actual(150) -> field should rise
        time.sleep(2.2)
        f1 = self.r.field_pct()
        time.sleep(2.2)
        f2 = self.r.field_pct()
        self.check(
            "C2 raise current SP above actual current -> field trends up",
            f2 >= f1 - 0.01, f"field {f1:.2f}% -> {f2:.2f}% after SP 100A->200A (actual 150A held)",
        )

    def c3_lower_temp_sp_triggers_derate(self):
        self.r.reset_defaults()
        self.r.inject(alt_t=70)
        time.sleep(SETTLE_S)
        w0 = self.r.warning()
        self.r.set_t_sp(60)  # derate_start = 55C; actual 70C >= 55C -> derate + warning
        time.sleep(SETTLE_S)
        w1, lim = self.r.warning(), self.r.status_field("lim")
        self.check(
            "C3 lower temp SP below actual temp -> derate + warning activate",
            (not w0) and w1 and lim is not None and lim < 150,
            f"warning before={w0} after={w1}, status lim={lim} (expected <150 due to derate)",
        )

    def c4_raise_temp_sp_lifts_derate(self):
        self.r.set_t_sp(95)  # derate_start=90C; actual 70C < 90C -> derate lifts
        time.sleep(SETTLE_S)
        w, lim = self.r.warning(), self.r.status_field("lim")
        self.check(
            "C4 raise temp SP above actual temp -> derate lifts, warning clears",
            (not w) and lim is not None and lim >= 149.9,
            f"warning={w}, status lim={lim} (expected False, ~150)",
        )

    def c5_live_absorption_v_change_no_stage_reset(self):
        self.r.reset_defaults()
        self.r.inject(house_v=14.30, alt_i=80)
        time.sleep(SETTLE_S)
        assert self.r.stage() == "absorption", "precondition"
        self.r.set_abs_v(14.35)
        time.sleep(SETTLE_S)
        st, fd = self.r.stage(), self.r.field_pct()
        self.check(
            "C5 live absorption-voltage change mid-absorption doesn't reset stage",
            st == "absorption" and fd == fd,
            f"stage={st} field={fd} after abs_v 14.30V->14.35V",
        )
        self.r.set_abs_v(14.3)  # restore

    # =====================================================================
    # D. Sensor failure modes (grounded in real-component failure reports --
    # see homeassistant/esphome/docs/HIL_TEST_PROCEDURE.md for citations)
    # =====================================================================
    def d1_house_v_sensor_stale(self):
        self.r.reset_defaults()
        self.r.fail_house_v(True)
        ok, al = self.r.c.wait_until(
            "binary_sensor", self.r.s.n("Alarm Active"),
            lambda v: Rig._truthy(v), timeout_s=4.5, poll_s=0.3,
        )
        # Alarm Active publishes every 250ms tick, but the Charge Stage
        # text_sensor only republishes once per second (its own
        # update_interval) -- reading it in the same instant alarm flips
        # can catch a stale pre-fault value. One publish cycle of settle
        # avoids a false negative here (see issue #28 report).
        time.sleep(1.1)
        st = self.r.stage()
        self.check(
            "D1 house voltage sensor stale (INA226 bus-lockup analog) -> fault within SENSOR_TIMEOUT_MS",
            ok and st == "off",
            f"alarm reached ON: {ok}, stage={st} (SENSOR_TIMEOUT_MS=3000ms)",
        )
        self.r.fail_house_v(False)
        time.sleep(SETTLE_S)
        recovered = self.r.stage() == "bulk" and not self.r.alarm()
        self.check(
            "D1b this firmware build self-clears once the stale sensor recovers "
            "(pre-#14: no fault latch on this physical device -- see issue #28 notes)",
            recovered, f"stage={self.r.stage()} alarm={self.r.alarm()} after un-failing",
        )

    def d2_alt_i_sensor_stale(self):
        self.r.reset_defaults()
        self.r.fail_alt_i(True)
        ok, al = self.r.c.wait_until(
            "binary_sensor", self.r.s.n("Alarm Active"),
            lambda v: Rig._truthy(v), timeout_s=4.5, poll_s=0.3,
        )
        self.check(
            "D2 alternator current sensor stale -> fault within SENSOR_TIMEOUT_MS",
            ok, f"alarm reached ON: {ok}",
        )
        self.r.fail_alt_i(False)

    def d3_alt_t_sensor_stale(self):
        self.r.reset_defaults()
        self.r.fail_alt_t(True)
        ok, al = self.r.c.wait_until(
            "binary_sensor", self.r.s.n("Alarm Active"),
            lambda v: Rig._truthy(v), timeout_s=6.5, poll_s=0.3,
        )
        self.check(
            "D3 alternator temperature sensor stale -> fault within TEMP_TIMEOUT_MS",
            ok, f"alarm reached ON: {ok} (TEMP_TIMEOUT_MS=5000ms)",
        )
        self.r.fail_alt_t(False)

    def d4_rpm_sensor_stale_disarms_gate_silently(self):
        """High-value finding, hypothesized from reading the source and
        confirmed empirically here: unlike house_v/alt_i/alt_t, a stale RPM
        signal is NOT in the sensor_bad/sensor_stale fault check at all --
        the RPM-gate interlock (#13) only acts while RPM data is FRESH. Once
        RPM goes stale past RPM_TIMEOUT_MS, the interlock's own freshness
        guard disarms it -- silently, with no fault or warning raised, even
        though the interlock exists specifically to stop the field on a
        stalled/belt-off alternator. A loose RPM tap connection would
        silently disable the protection instead of failing safe."""
        self.r.reset_defaults()
        self.r.set_rpm_gate(100)
        self.r.inject(rpm=50)  # below gate
        time.sleep(SETTLE_S)
        armed_field, armed_warn = self.r.field_pct(), self.r.warning()
        self.check(
            "D4a RPM gate interlock trips field=0 + warning while RPM is fresh and <= gate",
            armed_field == 0 and armed_warn,
            f"field={armed_field} warning={armed_warn} (rpm=50 <= gate=100, fresh)",
        )
        self.r.fail_rpm(True)  # simulate the sensor going stale/disconnected
        ok, _ = self.r.c.wait_until(
            "binary_sensor", self.r.s.n("Warning Active"),
            lambda v: not Rig._truthy(v), timeout_s=6.5, poll_s=0.3,
        )
        # Field Duty is a 1s-interval sensor too -- give it one publish
        # cycle to reflect the field actually resuming (see issue #28 report).
        time.sleep(1.1)
        disarmed_field = self.r.field_pct()
        self.check(
            "D4b CONFIRMED GAP: stale RPM sensor silently DISARMS the gate "
            "interlock instead of failing safe -- field resumes despite "
            "unknown rotational state (see issue #13 comment)",
            ok and disarmed_field > 0,
            f"warning cleared: {ok}, field resumed to {disarmed_field}% "
            f"after RPM sensor went stale past RPM_TIMEOUT_MS=5000ms",
        )
        self.r.fail_rpm(False)
        self.r.set_rpm_gate(0)
        self.r.inject(rpm=1200)

    def d5_out_of_range_values_trip_hard_ceilings(self):
        self.r.reset_defaults()

        self.r.inject(house_v=15.0)  # > HOUSE_V_CEIL 14.4 -- INA226 miscal/runaway analog
        time.sleep(SETTLE_S)
        v_trip = self.r.alarm() and self.r.field_pct() == 0
        self.check(
            "D5a implausible house voltage (15.0V, INA226-miscalibration analog) -> hard trip",
            v_trip, f"alarm={self.r.alarm()} field={self.r.field_pct()} (injected 15.0V > 14.4V ceiling)",
        )

        self.r.reset_defaults()
        self.r.inject(alt_i=255)  # > ALT_I_CEIL 250
        time.sleep(SETTLE_S)
        i_trip = self.r.alarm() and self.r.field_pct() == 0
        self.check(
            "D5b implausible current (255A) -> hard trip",
            i_trip, f"alarm={self.r.alarm()} field={self.r.field_pct()} (injected 255A > 250A ceiling)",
        )

        self.r.reset_defaults()
        self.r.inject(alt_t=130)  # > ALT_T_CEIL 125 -- DS18B20 garbage/CRC-fail analog
        time.sleep(SETTLE_S)
        t_trip = self.r.alarm() and self.r.field_pct() == 0
        self.check(
            "D5c implausible temperature (130C, DS18B20 out-of-range analog) -> hard trip",
            t_trip, f"alarm={self.r.alarm()} field={self.r.field_pct()} (injected 130C > 125C ceiling)",
        )

    def d6_intermittent_connection_tolerance(self):
        """Real-world finding this models: 'wiggle test reveals flickering
        readings, intermittent open masquerading as a dying alternator' --
        brief connection blips should NOT nuisance-trip a timeout-based
        staleness check, but a sustained loss still must."""
        self.r.reset_defaults()
        for _ in range(5):
            self.r.fail_house_v(True)
            time.sleep(0.4)
            self.r.fail_house_v(False)
            time.sleep(0.4)
        no_trip = not self.r.alarm() and self.r.stage() != "off"
        self.check(
            "D6a brief flapping connection (5x 0.4s blips, all < SENSOR_TIMEOUT_MS) "
            "does not nuisance-trip",
            no_trip, f"alarm={self.r.alarm()} stage={self.r.stage()} after flapping",
        )

        self.r.fail_house_v(True)
        ok, _ = self.r.c.wait_until(
            "binary_sensor", self.r.s.n("Alarm Active"),
            lambda v: Rig._truthy(v), timeout_s=4.5, poll_s=0.3,
        )
        self.check(
            "D6b a SUSTAINED loss (>SENSOR_TIMEOUT_MS) still trips -- "
            "tolerance has a real ceiling, doesn't mask a genuine disconnect",
            ok, f"alarm reached ON: {ok}",
        )
        self.r.fail_house_v(False)

    def run_full(self):
        print(f"\n=== {self.r.s.label} -- full scenario suite ===")
        for fn in [
            self.a1_bulk_default, self.a2_bulk_to_absorption_boundary,
            self.a3_absorption_to_float_via_tail_current, self.a4_float_rebulk_hysteresis,
            self.a5_temp_in_bounds_no_warning_throughout,
            self.b2_current_step_up_field_trends_down, self.b3_current_step_down_field_trends_up,
            self.b4_absorption_large_v_sag_stays_absorption, self.b5_reverse_current_sanity_trip,
            self.c1_lower_current_sp_below_actual, self.c2_raise_current_sp_above_actual,
            self.c3_lower_temp_sp_triggers_derate, self.c4_raise_temp_sp_lifts_derate,
            self.c5_live_absorption_v_change_no_stage_reset,
            self.d1_house_v_sensor_stale, self.d2_alt_i_sensor_stale, self.d3_alt_t_sensor_stale,
            self.d4_rpm_sensor_stale_disarms_gate_silently,
            self.d5_out_of_range_values_trip_hard_ceilings,
            self.d6_intermittent_connection_tolerance,
        ]:
            try:
                fn()
            except Exception as e:  # noqa: BLE001 -- record and keep going
                self.results.append(Result(fn.__name__, False, f"EXCEPTION: {e!r}"))
                print(f"  [ERROR] {fn.__name__} -- {e!r}")

    def run_confirmation(self):
        """Smaller parity check for the mirrored side -- proves the second
        copy of the control-loop code behaves the same without doubling
        total runtime."""
        print(f"\n=== {self.r.s.label} -- confirmation subset ===")
        for fn in [
            self.a1_bulk_default, self.a2_bulk_to_absorption_boundary,
            self.c1_lower_current_sp_below_actual,
            self.d1_house_v_sensor_stale,
            self.d5_out_of_range_values_trip_hard_ceilings,
        ]:
            try:
                fn()
            except Exception as e:  # noqa: BLE001
                self.results.append(Result(fn.__name__, False, f"EXCEPTION: {e!r}"))
                print(f"  [ERROR] {fn.__name__} -- {e!r}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="192.168.10.48")
    args = p.parse_args()

    client = ESPHomeWebClient(args.host)
    if not client.is_reachable():
        print(f"FATAL: {args.host} not reachable", file=sys.stderr)
        return 2

    results: list[Result] = []
    port = Rig(client, Side("Port"))
    stbd = Rig(client, Side("Starboard"))

    try:
        Suite(port, results).run_full()
        Suite(stbd, results).run_confirmation()
    finally:
        print("\nRestoring both sides to safe defaults...")
        port.reset_defaults()
        stbd.reset_defaults()

    passed = sum(1 for r in results if r.passed)
    failed = [r for r in results if not r.passed]
    print(f"\n=== SUMMARY: {passed}/{len(results)} passed ===")
    for r in failed:
        print(f"  FAILED: {r.name} -- {r.detail}")

    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
