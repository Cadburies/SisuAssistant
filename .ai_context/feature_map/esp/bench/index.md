---
title: Bench Marine Board (lab)
id: esp/bench
kind: device
tags: bench lab marine board gpio test hil web server
status: live
script: index.sh
audience: agent
---
Lab configuration for a Marine Board on the bench: every GPIO exposed for hardware-in-the-loop testing. Not a vessel role.

- **Reach:** Flash `bench_marine_board.yaml` to a bench board; open its web page
- **Action:** exercise GPIOs and sensors from the web page or `scripts/esphome_web_client.py`.
- **Needs:** a Marine Board on the bench; lab only — never on a production engine
- **Expect:** All GPIO switches/sensors listed on the web page.
- **Source:** `homeassistant/esphome/bench_marine_board.yaml` · `scripts/esphome_web_client.py`
