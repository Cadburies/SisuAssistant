#!/usr/bin/env python3
"""Add-on entry: options.json → env, then nmea_wind_daemon.py (#57)."""
from __future__ import annotations

import json
import os
import shutil
import sys

OPTS = "/data/options.json"
PARSER_SRC = "/homeassistant/python_scripts/nmea_gateways.py"
PARSER_DST = "/app/nmea_gateways.py"
DAEMON = "/app/nmea_wind_daemon.py"


def main() -> None:
    opts = json.load(open(OPTS, encoding="utf-8"))
    env = {
        "YDWG_HOST": str(opts.get("ydwg_host") or "192.168.10.30"),
        "YDWG_PORT": str(opts.get("ydwg_port") or 1456),
        "DATAHUB_HOST": str(opts.get("datahub_host") or "192.168.10.31"),
        "DATAHUB_PORT": str(opts.get("datahub_port") or 11102),
        "MQTT_HOST": str(opts.get("mqtt_host") or "127.0.0.1"),
        "MQTT_PORT": str(opts.get("mqtt_port") or 1883),
        "MQTT_USER": str(opts.get("mqtt_username") or ""),
        "MQTT_PASSWORD": str(opts.get("mqtt_password") or ""),
        "MQTT_KERNEL_PREFIX": str(opts.get("mqtt_kernel_prefix") or "sisu/v1"),
        "TZ": os.environ.get("TZ", "America/Tortola"),
    }
    os.environ.update(env)
    if not os.path.isfile(PARSER_SRC):
        sys.exit(f"missing parser {PARSER_SRC} (homeassistant_config map)")
    shutil.copy(PARSER_SRC, PARSER_DST)
    if not os.path.isfile(DAEMON):
        sys.exit(f"missing {DAEMON}")
    os.chdir("/app")
    os.execv(sys.executable, [sys.executable, "-u", DAEMON])


if __name__ == "__main__":
    main()
