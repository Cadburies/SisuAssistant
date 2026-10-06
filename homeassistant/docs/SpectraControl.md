# Spectra Newport 400c — page atlas

Device: `192.168.0.25:9000` · WebSocket · subprotocol `dumb-increment-protocol`.  
Bridge: `homeassistant/python_scripts/spectra_ws.py` · HA: `packages/spectra_newport.yaml`.  
Source policy: `.ai_context/sources.md`. Tank **fill % for auto-stop** is ESP waterlevels, not this machine’s page-4 gauge.

The controller **pushes JSON ~1 s of the page on screen**. There is no “read all pages” API. Values that only exist on a run page stay last-good with `page=` / `stale` if a kernel publishes them.

## Wire

| Action | Payload |
|---|---|
| Status | listen (no request) |
| Soft key | `{"page":"<cur>","cmd":"BUTTON0"\|"BUTTON1"\|"BUTTON2"\|"BUTTON3"}` |
| Focus field | `{"page":"<cur>","cmd":"LABEL0"}` |
| Type amount | `{"page":"12","data":"400"}` |
| Cancel / Help | `{"page":"<cur>","cmd":"CANCEL"\|"HELP"}` |

CLI: `status` · `cmd START\|STOP\|FLUSH\|CANCEL\|HELP` · `autorun [n] [liters\|hours]` · `stop` · `cancel_flush` · `raw PAGE CMD\|data:VALUE`

## Navigation (confirmed)

```
4 Home
 ├─ BUTTON0  FLUSH     → FWF (home labels / overlay)
 ├─ BUTTON1  START     → 37 SELECT RUN MODE
 │    └─ AUTORUN       → 29 AMOUNT
 │         ├─ BUTTON1 liters · BUTTON2 hours
 │         ├─ LABEL0   → 12 keyboard → data:<n> → 29
 │         └─ BUTTON3 OK → 10 SYSTEM STARTING → 32 AUTORUN
 │                            (also seen: 6, 30, 31, 33, 39, 40)
 └─ BUTTON2  STOP      → stay 4
Run pages: STOP = BUTTON0
29 back = BUTTON0 · 12/13 = CANCEL
```

Home START/FLUSH aliases in script: START→BUTTON1, FLUSH/FWF→BUTTON0 (page 4 only). STOP is context-aware (`smart_stop`).

## Pages

| Page | How you get there | Readable data | JSON / how | Rooted? |
|---|---|---|---|---|
| **4 Home** | Boot, STOP from run, FWF done | Model, AUTOSTORE text, FWF/START/STOP labels, **gauge0 %** | `label0–3`, `button0–2`, `gauge0` | Gauge % is **Spectra tank sender or FWF progress**, not ESP house tanks. |
| **6** | Some run paths | Boost bar, feed bar | `gauge*` mapped by BOOST/FEED in paired label | Yes if labeled |
| **10** | After OK on 29; also idle in Autostore | “SYSTEM STARTING” countdown **or** `AUTOSTORE MODE` / `Autostore : 6d 4h 38m` (only button: MENU) | `label0–1`, `button0` | Running only while starting — Autostore on page 10 is **not running** (#165). How to leave Autostore for a run is not confirmed live; autorun leaves that screen alone |
| **12** | LABEL0 from 29 | Keyboard prompt / typed amount | `data` | Yes (operator input) |
| **13** | Dialogs | Cancel copy | labels | Yes |
| **29 AMOUNT** | AUTORUN from 37 | Unit radios, amount, OK | `label2` liters, `label3` hours | Yes (operator input) |
| **32 AUTORUN** | After 10 | Status, STOP, **feed / filter % / quality ppm** when labels say so | `label1–3` + `gauge0–2` (`normalize()`) | **Best process data** |
| **30, 31, 33, 39, 40** | Other run / transition | Treated as `running` | same mapper | **Seen in wait-lists, not live field-dumped** |
| **37 SELECT** | START from 4 | FILLTANK / AUTORUN | `label0`, buttons | Yes (mode) |

`normalize()` maps gauges by **label text** (FILTER → %, QUALITY/ppm → ppm, BOOST/FEED → bar). Unlabeled first `bar` → feed. Home page 4 plain % → tank (not filter). `running` / `flushing` are **inferred** from page id + label words, not a device flag.

## HA fields (current page only)

`page`, `model`, `mode`, `status_line`, `button0–3`, `tank_percent` / `tank_raw`, `autostore`, `alarm`, `warning`, `running`, `flushing`, `feed_pressure`, `boost_pressure`, `filter_percent`, `product_ppm`.

## Kernel

Publish `sisu/v1/watermaker/*` once. Page-32-only quantities keep last-good + `source=spectra` + `page` + `stale_s`. Do not treat page-4 tank % as `tanks.fresh.*`.
