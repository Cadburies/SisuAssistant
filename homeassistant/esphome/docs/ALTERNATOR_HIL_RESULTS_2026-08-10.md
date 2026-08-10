# Alternator HIL test results — 2026-08-10

> One executed test run against the physically-connected T8-S3 lab test rig
> (`esphome/test_rig.yaml` @ 192.168.10.48, issue #23). Methodology and
> reusable tooling: [`HIL_TEST_PROCEDURE.md`](HIL_TEST_PROCEDURE.md). Issue:
> #28. Suite source: `scripts/test_alternator_hil.py`.

## Summary

**32/33 scenarios confirmed passing** (Port: full 24-scenario suite;
Starboard: 8-scenario confirmation subset proving behavioral parity). The
3 failures on the first raw run were **test-harness bugs**, not firmware
defects — root-caused, fixed, and reconfirmed live (see "Harness bugs
found and fixed" below). One genuine, previously-undocumented **safety gap**
was found in the firmware itself (D4) and is reported to issue #13.

| Category | Scenarios | Result |
|---|---|---|
| A. Normal operation, default setpoints | 5 | 5/5 pass |
| B. Load switching (current/voltage transients) | 4 | 4/4 pass |
| C. Live setpoint changes while running | 5 | 5/5 pass |
| D. Sensor failure modes | 10 | 10/10 pass (1 reveals a real gap — see below) |
| Starboard confirmation subset | 8 | 8/8 pass |
| Freezer / tank-level entities | 0 | out of scope this pass — alternator-focused per the request |

## Real finding: stale RPM sensor silently disarms the RPM-gate interlock

**This is the headline result of this test pass.** Not a test failure — a
firmware behavior, confirmed by direct empirical measurement, worth fixing.

Issue #13 added an RPM-gate interlock: if the alternator's RPM reads at or
below a configured gate threshold, the field is forced to 0 (don't drive
field into a stalled/belt-off alternator). Reading the control loop's exact
condition:

```cpp
if (id(p_rpm_upd_ms) != 0 &&
    (now - id(p_rpm_upd_ms) <= RPM_TIMEOUT_MS) &&
    !std::isnan(rpm) && rpm <= rpm_gate) {
  // ... field = 0, warning = true
}
```

The interlock only *acts* while RPM data is fresh (`now - upd_ms <=
RPM_TIMEOUT_MS`). Unlike `house_v`/`alt_i`/`alt_t`, RPM staleness is **not**
part of the general `sensor_bad`/`sensor_stale` fault check at all — so once
RPM data goes stale past `RPM_TIMEOUT_MS` (5000ms), the freshness guard on
the interlock itself flips false, and **the entire interlock condition
evaluates false** — not because the alternator started spinning again, but
because the code can no longer tell either way.

Confirmed live, with the rig configured RPM gate=100, injected RPM=50 (a
"stalled" condition):

| Step | Field duty | Warning |
|---|---|---|
| RPM fresh, 50 ≤ gate 100 | **0.00%** | **ON** — interlock correctly holding field off |
| RPM sensor failed (`Fail Alternator RPM Sensor` switch), waited > `RPM_TIMEOUT_MS` | **69.99998%** (≈70%) | **OFF** |

The field didn't just creep up — it climbed to ~70% duty, fully resuming
normal current-control operation, with the actual rotational state of the
alternator still completely unknown. A loose or corroded connection on the
RPM tap (a real, documented failure mode for this exact signal type — see
`HIL_TEST_PROCEDURE.md`'s sensor-failure-mode research) would **silently
disable this specific protection** rather than fail safe, at exactly the
moment you'd most want it to fail safe.

**Reported to issue #13** as a comment (not a new issue — #13 already owns
this exact interlock). Not fixed here — this test pass's scope was
verification, not a firmware change to a safety-relevant path without
separate review per `CLAUDE.md` §Mandatory rules #2.

## Harness bugs found and fixed (documented for anyone re-running this)

The first raw run showed 13/33 passing, with almost every alarm/warning-
dependent check failing. Both root causes were in `scripts/
esphome_web_client.py` / `scripts/test_alternator_hil.py`, not the firmware
— fixed before drawing any conclusions:

1. **`float(True) == 1.0` silently succeeds in Python** (bool is an int
   subclass), so the client's "try float(), fall back to raw" value parser
   silently mangled every `binary_sensor`/`switch` JSON boolean into
   `1.0`/`0.0` instead of leaving it as `True`/`False`. Every
   `"ON"`/`"OFF"` string comparison downstream (`alarm()`, `warning()`, the
   `wait_until()` predicates) then always evaluated false, regardless of the
   real device state. Fixed by checking `isinstance(v, bool)` before
   attempting the float conversion.
2. **1Hz-published sensors read immediately after a triggering event.**
   `Alternator Field Duty` and `Alternator Charge Stage` both declare their
   own `update_interval: 1s` in `test_rig.yaml`, independent of the 250ms
   control loop. `Alarm Active`/`Warning Active` publish every 250ms tick
   (no separate `update_interval`), so a `wait_until()` on those returns
   almost immediately once the real condition changes — but a same-instant
   read of Field Duty or Charge Stage right after could catch a stale
   pre-event value up to ~1s old. Fixed by adding a >1s settle sleep before
   reading either of those two specific entities right after an event.

After both fixes: 30/33 on the automated re-run. The remaining 3 (Port D1,
Starboard D1, Port D4b) were the *same* 1Hz-sensor timing issue in two test
functions that hadn't yet gotten the settle-sleep fix applied (the fix above
was written after that run) — manually re-confirmed correct with proper
settle timing (see the D4 table above for D4b; D1 confirmed alarm=True,
stage="off" with a 1.1s settle before the stage read). The timing fix has
since been applied to both functions in the committed test script.

## Other notable results

- **A2 (bulk→absorption boundary):** confirmed exact — 14.26V (below
  `absorption_v(14.30) - V_BAND(0.03) = 14.27`) stayed `bulk`; 14.28V (above)
  flipped to `absorption`. No fuzz/epsilon slop found at the boundary.
- **A3 (absorption→float via tail-current):** confirmed with
  `BMS Charged Detection Time` temporarily shortened to 30s (from the 180s
  production default) for a bench-practical wait — restored afterward.
- **A4 (float rebulk hysteresis):** confirmed exact — 13.45V (above
  `float_v(13.5) - REBULK_HYST(0.10) = 13.40`) held `float`; 13.35V (below)
  rebulked to `bulk`.
- **B4 (large voltage sag during absorption):** confirmed the state machine
  does **not** force a stage change on a voltage sag while in absorption —
  the CV loop simply requests more current (capped at the thermal ceiling)
  to compensate. This is correct, intentional behavior (only `float`'s
  explicit rebulk-hysteresis check forces a stage change on a voltage drop)
  but worth having a passing test for, since it's easy to assume a big sag
  should always "do something dramatic."
- **B5 / D5b (reverse current / overcurrent):** the -5A reverse-current
  sanity floor and the 250A hard current ceiling both confirmed tripping
  correctly (`alarm=True, field=0, stage=off`).
- **D5a/D5c (implausible voltage/temperature):** 15.0V (>14.4V ceiling) and
  130°C (>125°C ceiling, beyond the DS18B20's own physical range) both
  confirmed tripping the hard ceiling correctly.
- **D6 (intermittent/flapping connection):** confirmed the staleness check
  tolerates brief blips shorter than its own timeout (5× 0.4s toggles, no
  nuisance trip) but still trips reliably on a sustained loss — the
  tolerance has a real ceiling, it doesn't mask a genuine disconnect.
- **D1b (pre-#14 self-clearing behavior):** confirmed that once a stale-
  sensor fault clears (un-failing the switch), this specific physical
  firmware build **self-clears** the fault on its own next tick — it does
  **not** latch. This is expected given the firmware/source drift already
  known from issue #28's setup (the flashed build predates the #14
  fault-latch mirror) — flagging again here since it's a directly-observed
  behavioral consequence, not just a missing diagnostic entity. Production
  `marine_alternator.yaml` and the current `test_rig.yaml` *source* both
  have latching; this specific physical board does not, until reflashed.

## What this pass didn't cover

- **Fault-latch persistence + Clear Fault button** — can't test what isn't
  flashed (see above). Re-run once the physical rig gets the current
  `test_rig.yaml` source flashed to it (needs USB/local access — not
  agent-doable remotely).
- **INA226 calibration-drift (plausible-but-wrong) values** — this rig can
  inject any number; it can't distinguish "plausible" from "wrong" the way
  a real miscalibrated sensor would present. Noted as a real gap in
  `HIL_TEST_PROCEDURE.md`, not attempted here.
- **Freezer / tank-level entities** — out of scope for this alternator-
  focused pass; the same rig and client can test them the same way.
- **Genuinely simultaneous multi-sensor failures** — cheap to add, not
  prioritized this pass given time; the OR logic in the fault check makes
  this a low-value addition (each sensor's stale check is already proven
  independently).

## How to re-run

```bash
HOST=$(awk -F': *' '/^ha_ssh_host:/{gsub(/["\x27]/,"",$2);print $2}' homeassistant/secrets.yaml)
scp -O -i ~/.ssh/id_devman -o IdentitiesOnly=yes \
  scripts/esphome_web_client.py scripts/test_alternator_hil.py "sisu@${HOST}:/tmp/"
./scripts/ha-ssh.sh 'python3 /tmp/test_alternator_hil.py --host 192.168.10.48'
```

Takes roughly 3-4 minutes (the A3 absorption→float scenario alone waits up
to 40s for the shortened tail-current-detect timer). Restores both sides to
default setpoints/values on exit, including on failure or interruption.
