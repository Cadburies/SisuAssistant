---
title: Network › Sisu-Guest Wi-Fi
id: net/guest
kind: network
tags: guest wifi isolated qr code saloon display internet
status: live
script: guest.sh
---
Guest Wi-Fi, fully isolated from the boat LAN and IoT; guests join by scanning the QR on the saloon display.

- **Reach:** Saloon display → Wi-Fi page → scan the QR code (or join **Sisu-Guest** manually)
- **Action:** none for guests; the password lives in `guest_wifi_password`.
- **Needs:** guest Wi-Fi password / QR
- **Expect:** Guests get internet (when available) but cannot open HA, the F8 or any device.
- **Source:** `NETWORK.md` §3 · `scripts/gen_guest_wifi_qr.py`
