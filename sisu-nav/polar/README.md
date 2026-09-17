# Polar

Owned by issue **#78**. CSV matrices in this folder are loaded by `sisu-nav/api/route`.

`generic-cruising.csv` is a placeholder. **Polar quality dominates model choice** — replace with a measured Sisu polar before trusting ETAs.

Format: first column TWA (deg 0–180), header row TWS (kn), cells boat speed (kn). `#` comments ignored.

**Real-Sisu-polar groundwork (issue #132):** `sensor.sisu_polar_*` logs AWS/AWA/SOG/STW/TWS/TWA only when engines are off **and** SOG or STW is at least 1.5 kn (above dock/anchor “swimming”). Each Yanmar 4JH45 has a YDEG-04 on SeaTalkNG; those boxes go silent when the engine is off — that is treated as engines-off, not “RPM unknown”. Unknown is only when the YDWG itself is down. Deriving a measured `sisu.csv` from that Influx history is follow-on work.
