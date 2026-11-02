---
title: Freezer display › Device
id: esp/freezer-display
kind: device
tags: freezer display lilygo amoled touch screen setpoint fridge
status: unverified
script: index.sh
---
LilyGo S3 AMOLED for the aft-cockpit freezer, display only: it draws the Marine Board over ESP-NOW and uses HA only after that link has been quiet for about 10 seconds (#221).

- **Reach:** Walk up to the freezer display (web page `http://192.168.10.47/`)
- **Action:** right strip +/− changes the setpoint; title pill toggles COOL/OFF; left of the SET row picks freeze or fridge; right of the SET row cycles Low, Med, High.
- **Needs:** the controller powered. On the boat, Sisu Wi-Fi. With no router the pair still runs on ESP-NOW channel 6 after the real peer MACs are flashed.
- **Expect:** Title shows NOW, HA, or NO LINK. The controller keeps its stored setpoint when the screen has no link.
- **Source:** `homeassistant/esphome/freezer_display.yaml` · `MarineBoard/Documentation/Freezer-Replacement-Plan.md`
