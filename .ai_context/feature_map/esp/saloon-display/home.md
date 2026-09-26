---
title: Saloon display › Home page
id: esp/saloon-display/home
kind: page
tags: saloon display home tiles air water temperature depth wind max sunrise sunset tide moon
status: live
script: home.sh
---
5×2 tile grid: air and water temperature, depth, AWS max, sunrise/sunset, high/low tide and moonrise/moonset.

- **Reach:** Saloon display → Home (first page; swipe right from Wind)
- **Action:** display only.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered
- **Expect:** Tiles fill within a minute of boot; depth/wind tiles go blank if the NMEA feed goes silent (HA marks them unavailable after 30 s).
- **Source:** `homeassistant/esphome/saloon_display.yaml` (`page_home`)
