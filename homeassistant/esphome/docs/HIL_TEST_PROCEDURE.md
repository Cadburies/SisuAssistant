# ESP32 hardware-in-the-loop (HIL) test procedure

> Reusable methodology + tooling for testing ANY ESP32/ESPHome firmware on
> this project against real hardware, not a description of one test run.
> For the specific alternator test results, see
> [`ALTERNATOR_HIL_RESULTS_2026-08-10.md`](ALTERNATOR_HIL_RESULTS_2026-08-10.md).
> Tooling: `scripts/esphome_web_client.py`, `scripts/test_alternator_hil.py`.

## Why this exists

This project has no `flutter test`/host unit-test suite (see `CLAUDE.md` §4)
— firmware logic only really exists once it's running on real hardware. A
lab HIL rig that runs the *actual* control code against *injected* sensor
values (as opposed to a scripted-physics simulator) is the closest thing to
a unit test this project has: same binary, same control loop, same fail-safe
logic as production, but with sensor inputs you fully control and outputs
you can assert against.

Two lab devices currently do this on this project (see `.ai_context/INDEX.md`
Layout map):

| Device | Role | What it proves |
|---|---|---|
| `esphome/test_rig.yaml` (T8-S3, HIL) | Real control code, injected static values | The control/fail-safe *logic* is correct |
| `esphome/bench_alts_sim.yaml` (T8-S3, plant sim) | Scripted physics, no real controller | What an *operator* would see on a dashboard |

This doc is about the HIL pattern (test_rig-style). Don't confuse the two —
a plant sim proves nothing about the control logic itself.

**Gain / step-response tuning on a real alternator** is a different procedure
(live current, one side, written step table). See
[`homeassistant/docs/ALTERNATOR_TUNING.md`](../../docs/ALTERNATOR_TUNING.md).
HIL here does **not** identify `I_KP` / `I_KI`.

## Prerequisite: does the device actually match its source?

**Check this before writing a single test.** ESPHome's `web_server:`
component (every device on this project runs `port: 80, local: true`)
broadcasts its live entity list over Server-Sent Events, independent of
whatever Home Assistant thinks is registered:

```bash
./scripts/ha-ssh.sh 'timeout 4 curl -s -m 4 -N http://<device-ip>/events' > /tmp/ev.txt
python3 -c "
import json
names = set()
for line in open('/tmp/ev.txt'):
    if line.startswith('data: {'):
        d = json.loads(line[6:])
        if 'domain' in d and 'name' in d:
            names.add((d['domain'], d['name']))
for n in sorted(names): print(n)
"
```

Compare that list against what the device's `.yaml` source declares. If they
differ, you're not testing what you think you're testing (issue #28 found
exactly this: `test_rig.yaml`'s physical firmware predates its own issue #14
fault-latch mirror — the SOURCE has it, the FLASHED BUILD doesn't). Note the
gap in your test report rather than silently testing against stale
assumptions.

Separately: **do not trust Home Assistant's entity registry as ground
truth for a lab device.** Issue #29 found HA's registry for this exact rig
missing ~50 of ~90 entities the device actually broadcasts — confirmed via
neither a config-entry reload nor a full HA Core restart fixing it. The
device's own `web_server:` is authoritative; HA is a downstream mirror that
can silently desync.

## The client: talk to the device directly, not through HA

`scripts/esphome_web_client.py` is a small, dependency-free (stdlib only)
Python client for ESPHome's `web_server:` REST API. It works against **any**
ESPHome device on this project, not just the alternator rig — reuse it, don't
reimplement it.

Protocol (reverse-engineered from the device's own served JS — ESPHome's
public docs describe a slightly different, non-working URL shape for this
firmware version; see the client's docstring for the full derivation):

- `GET /<domain>/<url-encoded RAW ENTITY NAME>` → single JSON `{"value":...,
  "state":...}`. The path segment is the entity's **display name** (spaces,
  punctuation, unicode middle-dots and all), percent-encoded — *not* the
  slugified `object_id` you'd guess from a Home Assistant `entity_id`. Get
  this wrong and you get a misleading 404 that looks like "no such entity."
- `POST /<domain>/<name>/<action>?<param>=<value>` with header
  `Content-Type: application/x-www-form-urlencoded` and an explicit (even
  empty) body — omit the body and the ESP32's AsyncWebServer replies
  `411 Length Required` instead of doing anything useful.
- Actions: `number` → `set?value=X` · `switch` → `turn_on` / `turn_off` /
  `toggle` · `button` → `press`.
- **A JSON boolean is not a JSON number.** `float(True) == 1.0` succeeds
  silently in Python (bool is an int subclass) — if your client's "try to
  parse this as a float, fall back to the raw value" helper doesn't check
  `isinstance(v, bool)` *before* attempting `float()`, every switch/
  binary_sensor read gets silently mangled into `0.0`/`1.0` and any
  `"ON"`/`"OFF"` string comparison downstream just always fails, with no
  exception raised anywhere. This exact bug produced a wall of false
  failures on the first real run of this suite (see the results doc) —
  check for it explicitly if you're writing a new client from scratch.

Network note: ESPHome devices live on the Sisu-IoT VLAN, only reachable from
HA Green's own host shell (`scripts/ha-ssh.sh`), not from a laptop on the
main Sisu Wi-Fi. Deploy scripts there before running them:

```bash
# ha-scp.sh has a known bug on modern macOS clients (see Known gotchas below)
# -- use plain scp -O as a workaround until it's fixed:
HOST=$(awk -F': *' '/^ha_ssh_host:/{gsub(/["\x27]/,"",$2);print $2}' homeassistant/secrets.yaml)
scp -O -i ~/.ssh/id_devman -o IdentitiesOnly=yes \
  scripts/esphome_web_client.py scripts/test_alternator_hil.py "sisu@${HOST}:/tmp/"
./scripts/ha-ssh.sh 'python3 /tmp/test_alternator_hil.py --host <device-ip>'
```

## Designing scenarios

A HIL rig with **statically-injected** values (test_rig.yaml holds whatever
you last set — "no auto-ramping" per its own header comment) is not a plant
simulator. Design scenarios around that reality rather than fighting it:

1. **Steady-state assertions** — set inputs, wait a couple of control-loop
   ticks, assert an output. Cheap, most of your scenarios should be this.
2. **Manual ramps** — "house bank voltage rising" isn't something the rig
   does on its own; script a sequence of `inject()` calls stepping the value
   up, reading the output after each step. This is *more* useful than a
   real ramp for boundary testing (see next point).
3. **Boundary tests** — pick values on both sides of every threshold in the
   control code (`absorption_v - V_BAND`, `float_v - REBULK_HYST`, hard
   ceilings) and assert the transition happens exactly there, not "roughly."
4. **Bidirectional live-setpoint changes** — change a setpoint while the
   loop is running with the *actual* value already on the wrong side of it
   (current SP below actual current AND above it; temp SP below actual temp
   AND above it). A setpoint change that only ever moves toward the current
   state tells you nothing about the anti-windup/derate logic actually
   reacting.
5. **Sensor failure modes, grounded in real component behavior** — see next
   section. Don't invent generic "sensor returns garbage" tests; model the
   *actual* failure signatures the real ICs are documented to produce.
6. **Timing-sensitive reads need settle margin past the sensor's own publish
   rate, not just the control loop's tick rate.** `interval: 250ms` is the
   *control* loop; individual `sensor:`/`text_sensor:` entities often
   declare their own slower `update_interval` (this rig's Field Duty and
   Charge Stage are both 1s). Reading a value immediately after triggering
   an event can catch a stale pre-event publish. Either poll with
   `wait_until()` for the *specific* entity you care about, or add an
   explicit settle sleep clearly longer than that entity's own
   `update_interval` before a one-shot read.

## Real sensor failure modes (research-grounded, not invented)

The user's ask was explicit: ground failure-mode tests in how these
*actual* component families really fail, not a generic "return NaN and see
what happens." Findings, cited:

**DS18B20 (1-Wire temperature — `alt_t`, GPIO15 per `safety.md` #2):**
CRC errors are the dominant real-world failure, especially with multiple
sensors sharing one bus (community reports of up to ~90% CRC-failure rates
at 4 sensors on one bus) and with signal-integrity issues from bus noise —
[OpenEnergyMonitor community](https://community.openenergymonitor.org/t/ds18b20-reliability-considerations/9926),
[Adafruit forum](https://forums.adafruit.com/viewtopic.php?f=60&p=1023324&t=212209).
Environmental failure (moisture ingress) is also commonly reported for
buried/exposed sensors. A CRC failure is a firmware-layer concern one layer
below this control loop (reject the reading before it ever reaches
`alt_t`) — this HIL rig can't exercise CRC directly since values are
injected post-conversion, but it *can* exercise "what if a bad reading gets
through anyway": inject an out-of-physical-range value (this project tested
130°C, beyond the DS18B20's own -55..125°C span) and confirm the hard
ceiling still catches it as a backstop.

**INA226 (I2C current+voltage — `house_v`/`alt_i`, U2 @ 0x40 per
`safety.md` #2):** community-reported failure modes are I2C bus
lockup/hang requiring a reset, "if the I2C is interrupted, the program
aborts or shows strange values instead of 0," calibration-register
misconfiguration producing systematically wrong (not obviously invalid)
readings, and grounding faults preventing correct bus-voltage measurement —
[TI product page](https://www.ti.com/product/INA226),
[ESPHome issue #2506](https://github.com/esphome/issues/issues/2506),
[cicciocb forum](https://cicciocb.com/forum/viewtopic.php?t=1201). The
"bus lockup / stops updating" mode is exactly what this rig's `Fail ...
Sensor` switches model (freeze the freshness timestamp, exercise the
stale-sensor timeout) — the calibration-misconfiguration mode is a
plausible-but-wrong value, modeled by injecting an in-range-looking but
implausible number rather than an out-of-range one (harder to test
meaningfully on a rig that can't independently verify "plausible" — noted
as a real gap, see the results doc).

**RPM / tachometer signal (this project's own raw-AC-ripple tap via a
PC817C-S opto-isolator, issue #13/#26 — not a stock hall sensor):** the
closest real-world analog is automotive alternator W-terminal/AC-ripple
tachometer signal reliability. Two directly-relevant, documented findings:
"an alternator may not indicate on a tach, particularly at low RPM, if it
is feeding a full battery, because there is enough capacitance in the
circuit to reduce the AC portion of the signal to too low a value for the
tach to count pulses" — i.e. ripple amplitude legitimately drops with a
healthy, nearly-full battery, which is precisely the scenario the RPM-gate
interlock (#13) exists to handle safely — and "a quick wiggle check... can
reveal if readings flicker, likely finding an intermittent open masquerading
as a dying alternator" — i.e. loose connections present as *flickering*,
not a clean on/off — see
[bigdumboat.com](https://www.bigdumboat.com/LTS/taksig.html),
[ScannerDanner forum](https://www.scannerdanner.com/forum/post-your-repair-questions-here/8253-alternator-ac-ripple-waveform.html).
The intermittent/flapping-connection scenario in this project's test suite
(rapid on/off toggling of a `Fail ... Sensor` switch, faster than the
firmware's own staleness timeout) is modeled directly on this "wiggle test"
finding.

## Known gotchas (learned the hard way — issue #28)

- **`scripts/ha-scp.sh` is currently broken on modern macOS clients**: its
  `args[-1]` negative array index isn't supported by macOS's stock bash 3.2,
  and even after working around that, plain `scp` (SFTP-based, the modern
  default) fails with "subsystem request failed" against this host's SSH
  config. Workaround: `scp -O` (forces the legacy SCP protocol) with the
  same host/user/identity `ha-ssh.sh` uses. Worth a real fix in the script
  itself as a follow-up (not done here — shared ops tooling, out of this
  issue's scope).
- **A JSON `true`/`false` silently becomes `1.0`/`0.0`** through a naive
  "try float(), fall back to raw" value parser — see the client section
  above. Always special-case `bool` first.
- **1Hz-published sensor entities lag a 250ms control loop** — see scenario
  design point 6 above. This alone produced most of the false failures on
  first run.
- **HA's ESPHome entity registry can silently desync from the device** and
  neither a config-entry reload nor a full Core restart is guaranteed to fix
  it (issue #29, still open) — don't debug a HIL rig through HA's dashboard
  when the device's own `/events` stream is one `curl` away and authoritative.

## Checklist for testing a new ESP32 firmware file on this project

1. Confirm the device's live `/events` broadcast matches its `.yaml` source
   (see Prerequisite above) — don't assume a flash actually landed.
2. Reuse `scripts/esphome_web_client.py` — don't write a new HTTP client.
3. Enumerate every `number`/`switch`/`button` you can drive and every
   `sensor`/`binary_sensor`/`text_sensor` you can observe (the `/events`
   dump above gives you the exact `(domain, name)` pairs, verbatim).
4. Read the firmware's own hard-coded safety constants (timeouts, ceilings,
   hysteresis bands) directly from source rather than guessing — every
   boundary value is a scenario.
5. Group scenarios: normal operation at defaults → transient/load-step
   response → live setpoint changes (both directions) → sensor failure
   modes (grounded per-sensor, see above) → intermittent/flapping faults.
6. Always restore the rig to a known safe default state at the end, even on
   failure (a `finally` block) — it's shared bench equipment.
7. Write up genuinely surprising findings (not just pass/fail counts) as
   their own section, and cross-reference the relevant open issue rather
   than letting a real finding get buried in a wall of green checkmarks.
