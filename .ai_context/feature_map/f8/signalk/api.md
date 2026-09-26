---
title: Signal K › REST data API
id: f8/signalk/api
kind: route
tags: signal k rest api vessels self navigation data json
status: live
script: api.sh
audience: agent
---
Signal K REST data model at `/signalk/v1/api/vessels/self/…` used by HA scripts (route/course, engines) and agents.

- **Reach:** `http://192.168.0.21:3000/signalk/v1/api/vessels/self/` (token from `/signalk/v1/auth/login`)
- **Action:** GET any path; security is on, so log in first.
- **Needs:** on the boat's Sisu Wi-Fi/LAN · `SignalKUser`/`SignalKPwd` (`sk_get` in `_lib.sh`)
- **Expect:** Path JSON with `value`, `timestamp`, `$source`, e.g. `navigation/speedOverGround`.
- **Source:** `homeassistant/signalk/settings.json` · `homeassistant/python_scripts/signalk_course.py`
