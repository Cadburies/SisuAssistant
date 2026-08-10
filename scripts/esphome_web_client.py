#!/usr/bin/env python3
"""Generic ESPHome `web_server:` REST client -- for hardware-in-the-loop (HIL)
testing of ANY ESPHome device on this project, not just the alternator test
rig. See homeassistant/esphome/docs/HIL_TEST_PROCEDURE.md for the full
methodology this is meant to support.

Why this exists (issue #28): HA's own entity registry can silently be
incomplete or stale for a given ESPHome device (see issue #29 -- ~50 of ~90
entities on the T8-S3 test rig never made it into HA's registry, confirmed
via HA's own REST API and `.storage/core.entity_registry`, even after a
config-entry reload AND a full HA Core restart). The device's `web_server:`
component is authoritative ground truth regardless of HA's registry state,
and it's what every ESPHome device on this project already runs (`port: 80,
local: true`) for exactly this kind of bench access. Testing against it
directly is more reliable than testing through HA for HIL work, and doesn't
require HA to be involved at all.

Network note: ESPHome devices live on the Sisu-IoT VLAN (192.168.10.x), only
reachable from HA Green's own host shell (see scripts/ha-ssh.sh), not from a
laptop on the Sisu Wi-Fi. Run this script via:
    ./scripts/ha-scp.sh scripts/esphome_web_client.py /tmp/esphome_web_client.py
    ./scripts/ha-ssh.sh 'python3 /tmp/esphome_web_client.py --host 192.168.10.48 get number "Alternator Current Setpoint . Port"'
or import it from another script deployed the same way (as
test_alternator_hil.py does).

Protocol notes (reverse-engineered from the device's own served JS -- see
issue #28 for the full derivation, since ESPHome's public docs describe a
DIFFERENT, non-working URL shape for this firmware build):
  - GET  /<domain>/<url-encoded RAW NAME>            -> single JSON state
  - POST /<domain>/<url-encoded RAW NAME>/<action>?<param>=<value>
         with header Content-Type: application/x-www-form-urlencoded
         and an explicit (possibly empty) body, or the ESP32's AsyncWebServer
         responds 411 Length Required.
  - The URL path segment is the entity's *display name* (spaces, punctuation,
    unicode middle-dots and all), percent-encoded -- NOT the slugified
    object_id you'd guess from Home Assistant's entity_id. Get this wrong and
    you get a misleading 404 that looks like "no such entity" when the
    problem is only the encoding.
  - Actions: number -> "set?value=X" | switch -> "turn_on" / "turn_off" /
    "toggle" | button -> "press".
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import quote


class ESPHomeWebClient:
    def __init__(self, host: str, port: int = 80, timeout: float = 5.0):
        self.base = f"http://{host}:{port}"
        self.timeout = timeout

    def _entity_url(self, domain: str, name: str, action: str | None = None) -> str:
        # quote() with default safe="/" would leave literal "/" in a name
        # unescaped; entity names here never contain "/", but be strict.
        encoded = quote(name, safe="")
        url = f"{self.base}/{domain}/{encoded}"
        if action:
            url += f"/{action}"
        return url

    def get(self, domain: str, name: str) -> dict[str, Any]:
        """Single-shot JSON state for one entity: {"value":..., "state":...}."""
        req = urllib.request.Request(self._entity_url(domain, name))
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode())

    def get_value(self, domain: str, name: str) -> float | str | bool | None:
        d = self.get(domain, name)
        v = d.get("value")
        if v is None:
            return None
        if isinstance(v, bool):
            # bool is a subclass of int in Python, so float(True) == 1.0
            # succeeds silently -- must check this BEFORE the float() attempt
            # below, or every switch/binary_sensor read gets mangled into
            # 0.0/1.0 and silently breaks any caller comparing against
            # "ON"/"OFF" or True/False.
            return v
        try:
            return float(v)
        except (TypeError, ValueError):
            return v

    def _post_action(self, domain: str, name: str, action: str) -> None:
        url = self._entity_url(domain, name, action)
        req = urllib.request.Request(
            url, method="POST", data=b"",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            resp.read()

    def set_number(self, name: str, value: float) -> None:
        self._post_action("number", name, f"set?value={value}")

    def set_switch(self, name: str, on: bool) -> None:
        self._post_action("switch", name, "turn_on" if on else "turn_off")

    def toggle_switch(self, name: str) -> None:
        self._post_action("switch", name, "toggle")

    def press_button(self, name: str) -> None:
        self._post_action("button", name, "press")

    def wait_until(
        self, domain: str, name: str, predicate, timeout_s: float = 5.0,
        poll_s: float = 0.3,
    ) -> tuple[bool, Any]:
        """Poll an entity until predicate(value) is true or timeout. Returns
        (ok, last_value) -- last_value is whatever was last observed, useful
        for the failure message even when ok is False."""
        deadline = time.time() + timeout_s
        last: Any = None
        while time.time() < deadline:
            last = self.get_value(domain, name)
            if predicate(last):
                return True, last
            time.sleep(poll_s)
        last = self.get_value(domain, name)
        return predicate(last), last

    def is_reachable(self) -> bool:
        try:
            urllib.request.urlopen(self.base + "/", timeout=self.timeout)
            return True
        except (urllib.error.URLError, OSError):
            return False


def _cli() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", required=True)
    p.add_argument("--port", type=int, default=80)
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("get", help="GET a single entity's state")
    g.add_argument("domain")
    g.add_argument("name")

    n = sub.add_parser("set-number", help="POST a number entity's value")
    n.add_argument("name")
    n.add_argument("value", type=float)

    s = sub.add_parser("set-switch", help="turn a switch on/off")
    s.add_argument("name")
    s.add_argument("state", choices=["on", "off"])

    b = sub.add_parser("press", help="press a button entity")
    b.add_argument("name")

    args = p.parse_args()
    c = ESPHomeWebClient(args.host, args.port)

    if args.cmd == "get":
        print(json.dumps(c.get(args.domain, args.name)))
    elif args.cmd == "set-number":
        c.set_number(args.name, args.value)
        print(json.dumps(c.get("number", args.name)))
    elif args.cmd == "set-switch":
        c.set_switch(args.name, args.state == "on")
        print(json.dumps(c.get("switch", args.name)))
    elif args.cmd == "press":
        c.press_button(args.name)
        print("pressed")


if __name__ == "__main__":
    try:
        _cli()
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.reason}", file=sys.stderr)
        sys.exit(1)
