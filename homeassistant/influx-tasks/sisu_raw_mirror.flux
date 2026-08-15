// Mirror HA's live Sisu writes into the named Sisu_raw view (#47).
// Identity copy of the last 3 minutes, every minute.

option task = {name: "sisu_raw_mirror", every: 1m}

from(bucket: "Sisu")
    |> range(start: -3m)
    |> to(bucket: "Sisu_raw", org: "Sisu")
