---
title: Saloon display › Guest Wi-Fi page
id: esp/saloon-display/wifi
kind: page
tags: saloon display guest wifi qr code password sisu-guest
status: live
script: wifi.sh
---
Guest Wi-Fi network name, password and a QR code to join Sisu-Guest.

- **Reach:** Saloon display → swipe left from Wind (last page)
- **Action:** guests scan the QR with a phone camera to join.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered
- **Expect:** QR joins Sisu-Guest directly; the password text matches.
- **Source:** `homeassistant/esphome/saloon_display.yaml` (`page_wifi`) · `scripts/gen_guest_wifi_qr.py`
