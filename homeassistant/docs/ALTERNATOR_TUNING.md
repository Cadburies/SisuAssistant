# Alternator PI — how to test and tune

**Keep the cascaded PI.** Do not replace it with MPC, H∞, SMC, ANN, or similar.  
Safety at 250 A is the **supervisor** (hard latch + slew + derate), not a fancier regulator.

Ceilings and setpoints: **`ALTERNATOR_LIMITS.md`**. Control lambda: **`esphome/packages/marine_alternator.yaml`**. Logic HIL (not gain tuning): **`esphome/docs/HIL_TEST_PROCEDURE.md`**.

Gains today are conservative placeholders. Tuning is **measure, then one small edit** — not a new algorithm.

| Constant | Today | Unit |
|----------|------:|------|
| `I_KP` | 0.0030 | duty / A |
| `I_KI` | 0.0008 | duty / (A·s) |
| `V_KP` | 140 | A / V |
| `V_KI` | 8 | A / (V·s) |
| `FIELD_UP_PER_S` | 0.10 | duty / s |
| `FIELD_DOWN_PER_S` | 0.20 | duty / s |

No D on the current loop (shunt is filtered; D chatters the field). Same constants on Port and Starboard — do not fork sides.

**Do not** raise `ALT_I_CEIL` (250 A), `HOUSE_V_CEIL` (14.4 V), or `ALT_T_CEIL` (125 °C).

---

## Three plants — do not mix them

| Plant | What it is | What a tune here proves |
|-------|------------|-------------------------|
| `test_rig.yaml` (T8 HIL; physical board removed 2026-08-10) | Real control code, **injected** I/V/T | Logic / fail-safes / latch. **Not** field dynamics. |
| `bench_alts_sim.yaml` @ `.49` | Scripted physics, **no** real PI | Dashboard / operator view. Do not tune from this. |
| Production Marine Board `.41` / `.42` | Real LN 320 A + MOSFET + LFP | **The only place inner-loop gains are valid.** Blocked on #11 first-flash + safety review. |

After any control-lambda edit, re-run `scripts/test_alternator_hil.py` **before** a production OTA. Last full HIL: `esphome/docs/ALTERNATOR_HIL_RESULTS_2026-08-10.md`.

---

## Safety gates (live board)

Do not start a current step until all of these are true:

1. Production wrappers: `test_mode_enabled: "false"`.
2. ENBL is a physical switch you can drop in one motion. Someone’s hand is on it.
3. Hard ceilings still 250 A / 14.4 V / 125 °C **in the flashed build** (read `alt_msg` / ceiling diagnostics; do not assume git).
4. Start **one** side only. Leave `house_i_budget` at 300 A so a live peer caps this side at 150 A until you explicitly want more.
5. User SP `alt_i_sp` starts at **50 A**, never at 220 A.
6. House bank can accept the current (BMS not at HVC; headroom or load). A full LFP at 14.3 V slams the outer loop into CV and looks like a broken inner loop.
7. Log **before** enabling: `alt_i`, `alt_i_fast`, `house_v`, `alt_t`, field duty (`last_pwm` %), `alt_stage`, `alt_msg`, `fault_latched`, RPM. Grafana `Sisu_raw` or a ~4 Hz HA pull. Serial `INFO` on `alt_*` is the backup.

Anything wrong → ENBL off. Field must go 0 and **stay** 0 until you clear the latch.

---

## Phase 0 — dry HIL (no high current)

On a HIL-capable flash of the **same** control lambda:

1. Flashed build matches source (`web_server` `/events` vs YAML — see HIL procedure).
2. Run `scripts/test_alternator_hil.py` (copy with `scp -O`; `ha-scp.sh` is flaky on modern macOS).
3. Must still pass: hard I/V/T trips + latch, stale sensor → field 0, RPM gate, bidirectional SP changes, thermal derate slope, bulk→abs→float at `absorption_v − 0.03 V` and `float_v − 0.10 V`.
4. Failures here are firmware bugs. Do **not** “fix” them by raising gains on the boat.

---

## Phase 1 — inner current loop (bulk, one alt)

Engine running. Bank well below absorption (stage stays **bulk**, outer PI out of the way). Temp well below `Tsp − 5 °C`.

| Step | SP | Record |
|------|----|--------|
| 1 | 0 → **50 A** | Rise time to 90 %, overshoot, settle, field % vs time |
| 2 | 50 → **100 A** | Same |
| 3 | 100 → **150 A** | Default cruise. Same |
| 4 | 150 → **50 A** (down) | Down-slew is 2× up-slew; no undershoot that looks like a trip |
| 5 | Repeat 150 A at **low RPM** and **cruise RPM** | A / field-duty changes with RPM — why one Kp stays conservative |

**Keep the current gains if**

- `alt_i` does not hunt ±10 A at the 250 ms tick
- Overshoot ≤ ~10 % of the step (50→150 A: peak ≤ 165 A)
- Never kisses 250 A. A 150 A step that peaks above ~200 A → **lower `I_KP`**, do not raise the ceiling
- Field duty moves smoothly; no 0↔100 chatter
- `alt_i_fast` may lead `alt_i` by up to ~1 s (median vs moving average). Expected. Hard trip uses the fast path.

| Symptom | What to do |
|---------|------------|
| Sluggish (tens of seconds, field at 100 %) | ↑ `I_KP` ~20–30 %, one flash, re-step. Only then nudge `I_KI`. Never both at once. |
| Rings (I hunts, belt note, field sawtooth) | ↓ `I_KP` and/or `I_KI` ~30 %. Ring only on the down step → leave gains, slow `FIELD_DOWN_PER_S` (0.20). |
| Field pinned 0 or 100 %, I never matches | Not PI — ENBL, RPM gate, latched fault, or thermal derate. Read `alt_msg`. |

One change per flash. Write the step table (time, SP, peak I, settle I, field %) on the issue thread. That is the missing identification.

---

## Phase 2 — outer voltage loop (absorption / float)

Only after Phase 1 looks boring.

1. Let the bank climb until `house_v` is within ~0.1 V of `house_v_abs` (14.3 V default). Stage → **absorption**.
2. `alt_i` should taper as V sits on target. V must not chatter ±0.1 V.
3. Tail current **or** `abs_max_min` (default 120 min) → **float** (13.5 V).
4. House load drops V 0.10 V below float → **rebulk**.

If V overshoots 14.3 toward 14.4: lower `V_KP` / `V_KI`. The 14.4 V cut **latches** — kissing it is a failed tune.

If V sags and current does not come back: integral wound up while thermal-limited, or still in float. Check `alt_stage` and temp.

Do not tune outer and inner in the same session.

---

## Phase 3 — supervisor (pass/fail, not knobs)

Prefer HIL inject for hard trips. Do not disable the latch “so we can see the PI recover.”

| Test | How | Pass |
|------|-----|------|
| Overcurrent latch | HIL inject (preferred). Do not drive a real bank into 250 A. | Field 0, `fault_latched` on, stays on after I drops, clears only on ENBL cycle / Clear Fault |
| Overvoltage latch | HIL `house_v` 14.45 V | Same |
| Overtemp latch | HIL T 126 °C | Same |
| Thermal derate | HIL or a long 150 A run into `Tsp−5` | Request falls linearly; no trip until 125 °C |
| Stale I or V | Unplug INA226 / freeze updates > 3 s | Field 0 + latch |
| RPM gate | Gate above idle, or unplug tach | Field 0, **warning** (not latch), returns when RPM returns |
| Dual-alt | Second board online | Each request ≤ 150 A at default budget; peer unplugged → live side may take full user SP |

---

## Phase 4 — two alts (after each side is boring alone)

1. Same `house_i_budget` on both (300 A).
2. Both ENBL, both bulk, SP 150 A each.
3. Neither side sits at 200 A+ in the first 10 s (static half-split exists to stop that).
4. ENBL off on one side: survivor may rise toward its own SP (≤ 250 A), still respecting slew + inner PI.

---

## Firmware edit (only after a written Phase 1 table)

File: `homeassistant/esphome/packages/marine_alternator.yaml` (the `I_KP` / `V_KP` / `FIELD_*_PER_S` block).

| Symptom | Touch |
|---------|-------|
| Slow current, no overshoot | ↑ `I_KP` ~25 % |
| Slow leftover error after 10 s | ↑ `I_KI` slightly |
| Current oscillates | ↓ `I_KP` and `I_KI` |
| Harsh field / belt surge on up-step | ↓ `FIELD_UP_PER_S` (0.10 → 0.06) |
| Voltage overshoot in absorption | ↓ `V_KP` / `V_KI` |
| Good at cruise, wild at idle | **Do not** crank one Kp — RPM-schedule later |

Then: `esphome config` + `esphome compile` on `alternatorport.yaml`, human review, **one** production OTA, repeat Phase 1 at 50 A before 150 A.

Optional after the table exists (still PI underneath): RPM-scheduled `I_KP`, small RPM→field feedforward, or Victron GX **battery current** for the absorption→float tail.

Sea-trial retune is a separate issue, depends on **#11**. Do not drive-by `marine_alternator.yaml` while another claim owns that hotspot.
