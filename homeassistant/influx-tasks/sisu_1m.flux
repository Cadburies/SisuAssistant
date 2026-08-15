// Downsample HA's live write bucket Sisu → Sisu_1m (#47).
// HA's Influx UI entry still writes Sisu (cannot YAML-retarget).
// Directions use last() so 359°/1° wrap does not average to 180°.
// Applied by scripts/influx-sisu-views.sh (do not paste tokens here).

option task = {name: "sisu_1m", every: 1m}

dirs = ["sensor.nmea_twd", "sensor.nmea_twa", "sensor.nmea_awa",
        "sensor.nmea_cog", "sensor.nmea_heading_magnetic",
        "sensor.nmea_heading_true"]

from(bucket: "Sisu")
    |> range(start: -3m)
    |> filter(fn: (r) => r._field == "value")
    |> filter(fn: (r) => contains(value: r._measurement, set: dirs))
    |> aggregateWindow(every: 1m, fn: last, createEmpty: false)
    |> to(bucket: "Sisu_1m", org: "Sisu")

from(bucket: "Sisu")
    |> range(start: -3m)
    |> filter(fn: (r) => r._field == "value")
    |> filter(fn: (r) => not contains(value: r._measurement, set: dirs))
    |> aggregateWindow(every: 1m, fn: mean, createEmpty: false)
    |> to(bucket: "Sisu_1m", org: "Sisu")

from(bucket: "Sisu")
    |> range(start: -3m)
    |> filter(fn: (r) => r._field == "state")
    |> aggregateWindow(every: 1m, fn: last, createEmpty: false)
    |> to(bucket: "Sisu_1m", org: "Sisu")
