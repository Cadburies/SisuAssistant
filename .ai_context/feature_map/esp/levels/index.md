---
title: Water Levels › Marine Board
id: esp/levels
kind: device
tags: water levels tanks fresh fuel black 4-20ma board house voltage
status: planned
script: index.sh
---
Levels Marine Board: 4–20 mA tank senders (fresh water, fuel, black) and house voltage in the saloon.

- **Reach:** Browser on Sisu → `http://192.168.10.43/` (HA: Water › Tanks)
- **Action:** read tank levels; debug level.
- **Needs:** on the boat's Sisu Wi-Fi/LAN (the router forwards to Sisu-IoT); device powered; levels board fitted (#2)
- **Expect:** Tank % and litres once calibrated (#2); not yet on the LAN — scripts SKIP.
- **Source:** `homeassistant/esphome/waterlevels.yaml` · `homeassistant/esphome/packages/marine_board_base.yaml`
