#!/usr/bin/env python3
"""Send a Sisu house-bank notification over SMTP.

Called by ``shell_command.sisu_soc_100_email`` in
``packages/battery_full_email.yaml``.  Reads ``/config/secrets.yaml`` so the
credential stays out of the HA UI and out of git.  The live Sisu relay is Brevo
because Outlook.com disabled basic SMTP AUTH on the mailbox; any SMTP relay
(smtp_host/smtp_user/smtp_password) works.

  smtp_host       default smtp-mail.outlook.com
  smtp_port       default 587 (STARTTLS)
  smtp_user       SMTP login (the sender account)
  smtp_password   SMTP key or app password
  smtp_sender     From address, default smtp_user
  smtp_recipient  required recipient address (no default; keeps PII out of git)

Usage:
  notify_email.py --soc 100 --voltage 13.4 --current 12.1 --power 160
  notify_email.py --test

Exit: 0 sent · 1 SMTP error · 2 missing/placeholder credentials.
"""
from __future__ import annotations

import argparse
import re
import smtplib
import ssl
import sys
from datetime import datetime
from email.message import EmailMessage
from email.utils import formatdate
from pathlib import Path
from zoneinfo import ZoneInfo

_SECRET_CANDIDATES = (
    Path("/config/secrets.yaml"),
    Path(__file__).resolve().parent.parent / "secrets.yaml",
)
_TZ = ZoneInfo("America/Tortola")


def _load_secrets() -> dict[str, str]:
    out: dict[str, str] = {}
    for path in _SECRET_CANDIDATES:
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for line in text.splitlines():
            match = re.match(r'^([A-Za-z0-9_]+):\s*["\']?([^"\'#\n]*?)["\']?\s*(?:#.*)?$', line)
            if not match:
                continue
            key, value = match.group(1), match.group(2).strip()
            if value:
                out[key] = value
        if out:
            break
    return out


def _fmt(value: str | None) -> str:
    if value is None or value.strip() in ("", "unknown", "unavailable", "None"):
        return "n/a"
    return value.strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--soc")
    parser.add_argument("--voltage")
    parser.add_argument("--current")
    parser.add_argument("--power")
    parser.add_argument("--test", action="store_true")
    args = parser.parse_args()

    secrets = _load_secrets()
    host = secrets.get("smtp_host", "smtp-mail.outlook.com")
    port = int(secrets.get("smtp_port", "587"))
    user = secrets.get("smtp_user", "")
    password = secrets.get("smtp_password", "")
    sender = secrets.get("smtp_sender", "")
    if not sender or sender == "CHANGE_ME":
        sender = user
    recipient = secrets.get("smtp_recipient", "")

    if not user or not password or password == "CHANGE_ME" or not recipient or recipient == "CHANGE_ME":
        print(
            "notify_email: smtp_user/smtp_password/smtp_recipient missing in secrets.yaml",
            file=sys.stderr,
        )
        return 2

    now = datetime.now(_TZ).strftime("%Y-%m-%d %H:%M %Z")
    if args.test:
        subject = "Sisu HA email test"
        body = f"Home Assistant sent this through SMTP at {now}.\n"
    else:
        soc = _fmt(args.soc)
        subject = f"Sisu house bank at {soc}%"
        body = (
            "The house bank reached full charge.\n\n"
            f"SoC:     {soc} %\n"
            f"Voltage: {_fmt(args.voltage)} V\n"
            f"Current: {_fmt(args.current)} A\n"
            f"Power:   {_fmt(args.power)} W\n"
            f"Time:    {now}\n"
        )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message["Date"] = formatdate(localtime=True)
    message.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(user, password)
            smtp.send_message(message)
    except Exception as exc:  # noqa: BLE001 — every failure becomes exit 1 for HA logs
        print(f"notify_email: send failed: {exc}", file=sys.stderr)
        return 1

    print(f"notify_email: sent to {recipient}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
