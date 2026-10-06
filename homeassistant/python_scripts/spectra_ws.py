#!/usr/bin/env python3
"""Spectra Newport 400c WebSocket client (stdlib only).

Protocol (from device HTML / live capture):
  URL:  ws://HOST:9000
  Subprotocol: dumb-increment-protocol
  Status stream: JSON every ~1s
  Soft keys:  {"page":"<cur>","cmd":"BUTTON0"|"BUTTON1"|...}
  Text entry: focus label → {"page":"<cur>","cmd":"LABEL0"}
              keyboard page 12 → {"page":"12","data":"400"}
  Cancel/Help: {"page":"<cur>","cmd":"CANCEL"|"HELP"}

Known pages (Newport 400c):
  4  — Home: FRESH WATER FLUSH / START / STOP
  10 — System starting countdown (STOP on BUTTON0)
  12 — Keyboard input ("Enter amount in liters.")
  29 — AMOUNT: radio liters (BUTTON1) | hours (BUTTON2) + amount + OK (BUTTON3)
  32 — AUTORUN main dashboard (STOP on BUTTON0)
  37 — SELECT RUN MODE: FILLTANK / AUTORUN / …

Usage:
  spectra_ws.py status [host]
  spectra_ws.py cmd BUTTON0|START|STOP|FLUSH|CANCEL|HELP [host]
  spectra_ws.py autorun [amount] [liters|hours] [host]
      # full START→AUTORUN→amount→OK (default unit: liters)
  spectra_ws.py stop [host]                 # context-aware STOP
  spectra_ws.py cancel_flush [host]         # cancel/stop a freshwater flush
  spectra_ws.py raw PAGE CMD|data:VALUE [host]
"""
from __future__ import annotations

import base64
import json
import os
import re
import socket
import struct
import sys
import time

DEFAULT_HOST = os.environ.get("SPECTRA_HOST", "192.168.0.25")
PORT = int(os.environ.get("SPECTRA_PORT", "9000"))
SUBPROTO = "dumb-increment-protocol"

# Tank capacities (L) for shortfall calculation — forward + aft
TANK_FWD_L = float(os.environ.get("SPECTRA_TANK_FWD_L", "400"))
TANK_AFT_L = float(os.environ.get("SPECTRA_TANK_AFT_L", "400"))
DEFAULT_AUTORUN_L = float(os.environ.get("SPECTRA_DEFAULT_LITERS", "400"))
STOP_LEVEL_PCT = float(os.environ.get("SPECTRA_STOP_LEVEL_PCT", "95"))


# ---------------------------------------------------------------------------
# WebSocket (stdlib)
# ---------------------------------------------------------------------------

def _recv_exact(sock: socket.socket, n: int) -> bytes:
  buf = b""
  while len(buf) < n:
    chunk = sock.recv(n - len(buf))
    if not chunk:
      raise ConnectionError("socket closed")
    buf += chunk
  return buf


def _ws_connect(host: str, port: int, timeout: float = 5.0) -> socket.socket:
  key = base64.b64encode(os.urandom(16)).decode()
  req = (
    f"GET / HTTP/1.1\r\n"
    f"Host: {host}:{port}\r\n"
    f"Upgrade: websocket\r\n"
    f"Connection: Upgrade\r\n"
    f"Sec-WebSocket-Key: {key}\r\n"
    f"Sec-WebSocket-Version: 13\r\n"
    f"Sec-WebSocket-Protocol: {SUBPROTO}\r\n"
    f"\r\n"
  )
  sock = socket.create_connection((host, port), timeout=timeout)
  sock.sendall(req.encode())
  data = b""
  while b"\r\n\r\n" not in data:
    chunk = sock.recv(4096)
    if not chunk:
      raise ConnectionError("no handshake response")
    data += chunk
  if b"101" not in data.split(b"\r\n", 1)[0]:
    raise ConnectionError(f"handshake failed: {data[:200]!r}")
  return sock


def _ws_recv_text(sock: socket.socket) -> str:
  hdr = _recv_exact(sock, 2)
  b1, b2 = hdr[0], hdr[1]
  opcode = b1 & 0x0F
  masked = b2 & 0x80
  length = b2 & 0x7F
  if length == 126:
    length = struct.unpack("!H", _recv_exact(sock, 2))[0]
  elif length == 127:
    length = struct.unpack("!Q", _recv_exact(sock, 8))[0]
  mask = _recv_exact(sock, 4) if masked else b""
  payload = _recv_exact(sock, length)
  if masked:
    payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
  if opcode == 0x8:
    raise ConnectionError("websocket closed by peer")
  if opcode == 0x9:  # ping -> pong
    _ws_send_frame(sock, payload, opcode=0xA)
    return _ws_recv_text(sock)
  if opcode != 0x1:
    return _ws_recv_text(sock)
  return payload.decode("utf-8", errors="replace")


def _ws_send_frame(sock: socket.socket, payload: bytes, opcode: int = 0x1) -> None:
  mask = os.urandom(4)
  header = bytearray()
  header.append(0x80 | opcode)
  n = len(payload)
  if n < 126:
    header.append(0x80 | n)
  elif n < 65536:
    header.append(0x80 | 126)
    header.extend(struct.pack("!H", n))
  else:
    header.append(0x80 | 127)
    header.extend(struct.pack("!Q", n))
  header.extend(mask)
  masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
  sock.sendall(bytes(header) + masked)


def _ws_send_json(sock: socket.socket, obj: dict) -> None:
  _ws_send_frame(sock, json.dumps(obj).encode())


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------

class SpectraSession:
  def __init__(self, host: str = DEFAULT_HOST):
    self.host = host
    self.sock: socket.socket | None = None
    self.last: dict = {}

  def connect(self) -> None:
    self.sock = _ws_connect(self.host, PORT)
    self.sock.settimeout(3.0)
    self.last = self.drain(1.0) or {}

  def close(self) -> None:
    if self.sock:
      try:
        self.sock.close()
      except Exception:
        pass
      self.sock = None

  def __enter__(self) -> "SpectraSession":
    self.connect()
    return self

  def __exit__(self, *exc) -> None:
    self.close()

  def drain(self, secs: float = 1.0) -> dict:
    assert self.sock
    end = time.time() + secs
    last: dict = self.last or {}
    while time.time() < end:
      try:
        remaining = end - time.time()
        if remaining <= 0:
          break
        self.sock.settimeout(max(0.05, remaining))
        msg = _ws_recv_text(self.sock)
        try:
          last = json.loads(msg)
          self.last = last
        except json.JSONDecodeError:
          continue
      except (socket.timeout, TimeoutError, ConnectionError, OSError):
        break
    return last

  def wait_page(self, pages, timeout: float = 15.0, predicate=None) -> dict:
    """Wait until page is in pages (str/int/list) or predicate(msg) is true."""
    if isinstance(pages, (str, int)):
      pages = {str(pages)}
    else:
      pages = {str(p) for p in pages}
    end = time.time() + timeout
    while time.time() < end:
      cur = self.drain(0.8)
      if not cur:
        continue
      if str(cur.get("page", "")) in pages:
        if predicate is None or predicate(cur):
          return cur
      if predicate is not None and predicate(cur):
        return cur
    return self.last or {}

  def send(self, obj: dict, wait: float = 1.2) -> dict:
    assert self.sock
    page = str(obj.get("page") or self.last.get("page") or "4")
    payload = dict(obj)
    payload["page"] = page
    _ws_send_json(self.sock, payload)
    return self.drain(wait)

  def cmd(self, button_or_cmd: str, wait: float = 1.2) -> dict:
    page = str(self.last.get("page") or "4")
    return self.send({"page": page, "cmd": button_or_cmd}, wait=wait)

  def data(self, value: str, wait: float = 1.5) -> dict:
    page = str(self.last.get("page") or "12")
    return self.send({"page": page, "data": str(value)}, wait=wait)

  def find_button(self, *needles: str) -> str | None:
    """Return BUTTONn whose label matches any needle (case-insensitive substring)."""
    st = self.last or {}
    needles_u = [n.upper() for n in needles]
    for i in range(0, 8):
      key = f"button{i}"
      label = st.get(key)
      if not label:
        continue
      lu = str(label).upper()
      for n in needles_u:
        if n in lu:
          return f"BUTTON{i}"
    return None

  def press_labeled(self, *needles: str, wait: float = 1.5) -> dict:
    btn = self.find_button(*needles)
    if not btn:
      raise RuntimeError(
        f"no button matching {needles} on page {self.last.get('page')}; "
        f"buttons={[self.last.get(f'button{i}') for i in range(5)]}"
      )
    return self.cmd(btn, wait=wait)

  def is_autostore(self) -> bool:
    """Page 10 idle in Autostore (#165) — same page as SYSTEM STARTING."""
    st = self.last or {}
    return is_autostore_screen(st.get("page"), " ".join(
      str(st.get(k) or "") for k in ("label0", "label1")
    ))

  def is_running(self) -> bool:
    st = self.last or {}
    page = str(st.get("page", ""))
    line = " ".join(
      str(st.get(k) or "") for k in ("label0", "label1", "label2")
    ).upper()
    if self.is_autostore():
      return False
    if page in ("6", "10", "32", "30", "31", "33", "39"):
      return True
    if "AUTORUN" in line or "SYSTEM STARTING" in line:
      return True
    if "PRODUCT" in line or "MAKING" in line:
      return True
    return False

  def is_flushing(self) -> bool:
    st = self.last or {}
    line = " ".join(
      str(st.get(k) or "") for k in ("label0", "label1", "label2", "button0", "button1")
    ).upper()
    return "FLUSH" in line and "FRESH" in line or "WATER FLUSH" in line or (
      "FLUSH" in line and str(st.get("page")) not in ("4",)
    )

  def is_home(self) -> bool:
    st = self.last or {}
    page = str(st.get("page", ""))
    if page == "4":
      return True
    b1 = str(st.get("button1") or "").upper()
    return b1 == "START"

  def is_amount_page(self) -> bool:
    st = self.last or {}
    return str(st.get("page")) == "29" or str(st.get("label1") or "").upper() == "AMOUNT"

  def go_home(self, timeout: float = 20.0) -> dict:
    """Best-effort navigate back to home without starting pumps."""
    end = time.time() + timeout
    while time.time() < end:
      self.drain(0.5)
      if self.is_home():
        return self.last
      # cancel dialogs / input pages
      page = str(self.last.get("page", ""))
      if page in ("12", "13"):
        self.cmd("CANCEL", wait=1.0)
        continue
      # back buttons often BUTTON0 or BUTTON4 on menus
      back = self.find_button("BACK")
      if back:
        self.cmd(back, wait=1.0)
        continue
      if page == "29":
        # amount page: button0 is back
        self.cmd("BUTTON0", wait=1.0)
        continue
      if page == "37":
        self.cmd("BUTTON4", wait=1.0)  # back value=4
        continue
      # if running, don't auto-home; Autostore exit is untested live (#165)
      if self.is_running() or self.is_autostore():
        break
      # try CANCEL
      self.cmd("CANCEL", wait=1.0)
    return self.last


# ---------------------------------------------------------------------------
# High-level operations
# ---------------------------------------------------------------------------

def is_autostore_screen(page, labels: str) -> bool:
  """Page 10 is both the SYSTEM STARTING countdown and the idle AUTOSTORE
  MODE screen (label0 "AUTOSTORE MODE", label1 "Autostore : 6d 4h 38m",
  seen live 2026-09-26 and 2026-10-06). Only the latter is not running."""
  u = str(labels or "").upper()
  return str(page) == "10" and "AUTOSTORE" in u and "SYSTEM STARTING" not in u


def read_status(host: str = DEFAULT_HOST, wait: float = 4.0) -> dict:
  with SpectraSession(host) as s:
    s.drain(wait)
    return s.last or {}


def smart_stop(host: str = DEFAULT_HOST) -> dict:
  """Press whatever button is labeled STOP on the current page."""
  with SpectraSession(host) as s:
    s.drain(1.0)
    try:
      s.press_labeled("STOP", wait=2.0)
    except RuntimeError:
      # Fallbacks by page convention
      page = str(s.last.get("page", "4"))
      if page == "4":
        s.cmd("BUTTON2", wait=2.0)
      else:
        s.cmd("BUTTON0", wait=2.0)
    s.drain(2.0)
    return s.last


def cancel_flush(host: str = DEFAULT_HOST) -> dict:
  """Stop/cancel a freshwater flush if one is active."""
  with SpectraSession(host) as s:
    s.drain(1.0)
    line = " ".join(
      str(s.last.get(k) or "") for k in ("label0", "label1", "button0", "button1", "button2")
    ).upper()
    if "FLUSH" in line or s.is_flushing():
      try:
        s.press_labeled("STOP", "CANCEL", wait=2.0)
      except RuntimeError:
        s.cmd("CANCEL", wait=1.5)
        try:
          s.press_labeled("STOP", wait=1.5)
        except RuntimeError:
          s.cmd("BUTTON0", wait=1.5)
    s.drain(2.0)
    return s.last


def select_amount_unit(session: SpectraSession, unit: str = "liters") -> dict:
  """Page 29 AMOUNT: choose liters (BUTTON1) or hours (BUTTON2).

  Status stream shows radio state as button1/button2 = "1" (selected) or "0".
  Labels are label2=liters, label3=hours. Keyboard prompt becomes
  "Enter amount in liters." or hours equivalently after LABEL0.
  """
  unit = (unit or "liters").strip().lower()
  if unit in ("l", "liter", "litre", "litres"):
    unit = "liters"
  if unit in ("h", "hr", "hrs", "hour"):
    unit = "hours"
  if unit not in ("liters", "hours"):
    raise ValueError(f"unit must be liters or hours, got {unit!r}")

  # Already correct?
  b1 = str(session.last.get("button1") or "")
  b2 = str(session.last.get("button2") or "")
  if unit == "liters" and b1 == "1":
    return session.last
  if unit == "hours" and b2 == "1":
    return session.last

  if unit == "liters":
    # Prefer labeled press; fall back to radio value BUTTON1
    try:
      lab = str(session.last.get("label2") or "").upper()
      if "LITER" in lab or "LITRE" in lab:
        session.cmd("BUTTON1", wait=0.8)
      else:
        session.press_labeled("LITERS", "LITRES", "LITER", wait=0.8)
    except RuntimeError:
      session.cmd("BUTTON1", wait=0.8)
  else:
    try:
      lab = str(session.last.get("label3") or "").upper()
      if "HOUR" in lab:
        session.cmd("BUTTON2", wait=0.8)
      else:
        session.press_labeled("HOURS", "HOUR", wait=0.8)
    except RuntimeError:
      session.cmd("BUTTON2", wait=0.8)
  return session.last


def set_amount(
  session: SpectraSession,
  amount: float | int,
  unit: str = "liters",
) -> dict:
  """On page 29 AMOUNT: select unit (liters|hours), enter amount, OK.

  Mirrors panel: radio liters/hours → amount field → OK.
  """
  unit = (unit or "liters").strip().lower()
  if unit in ("l", "liter", "litre", "litres"):
    unit = "liters"
  if unit in ("h", "hr", "hrs", "hour"):
    unit = "hours"

  amount_s = str(int(amount) if float(amount) == int(float(amount)) else amount)
  select_amount_unit(session, unit)

  # Open keyboard via LABEL0 focus (prompt depends on unit)
  session.cmd("LABEL0", wait=1.5)
  if str(session.last.get("page")) != "12":
    session.cmd("LABEL0", wait=1.5)

  if str(session.last.get("page")) == "12":
    session.data(amount_s, wait=1.8)

  session.wait_page("29", timeout=5.0)
  label0 = str(session.last.get("label0") or "")
  if amount_s not in label0 and str(int(float(amount))) not in label0:
    if str(session.last.get("page")) == "29":
      select_amount_unit(session, unit)
      session.cmd("LABEL0", wait=1.2)
    if str(session.last.get("page")) == "12":
      session.data(amount_s, wait=1.8)
      session.wait_page("29", timeout=5.0)

  session.cmd("BUTTON3", wait=2.0)
  return session.last


def set_amount_liters(session: SpectraSession, liters: float | int) -> dict:
  """Back-compat wrapper: amount in liters."""
  return set_amount(session, liters, unit="liters")


def autorun(
  amount: float | int = DEFAULT_AUTORUN_L,
  host: str = DEFAULT_HOST,
  *,
  unit: str = "liters",
  flush_retry: bool = True,
  max_retries: int = 3,
  # back-compat alias
  liters: float | int | None = None,
) -> dict:
  """Full sequence: START → AUTORUN → set amount (liters|hours) → OK.

  Handles sticky FWF by cancelling flush and retrying (common Spectra quirk).
  Returns final status dict with extra keys: ok, amount, unit, steps, error.
  """
  if liters is not None:
    amount = liters
    unit = "liters"
  unit = (unit or "liters").strip().lower()
  if unit in ("l", "liter", "litre", "litres"):
    unit = "liters"
  if unit in ("h", "hr", "hrs", "hour"):
    unit = "hours"
  amount = float(amount)
  steps: list[str] = []
  last_err = None
  unit_label = "L" if unit == "liters" else "h"

  for attempt in range(1, max_retries + 1):
    steps.append(f"attempt {attempt}/{max_retries} amount={amount}{unit_label} unit={unit}")
    try:
      with SpectraSession(host) as s:
        s.drain(1.0)

        # If already running autorun, report success
        if s.is_running() and "AUTORUN" in " ".join(
          str(s.last.get(k) or "") for k in ("label0", "label1")
        ).upper():
          steps.append("already running autorun")
          out = normalize(s.last)
          out.update({
            "ok": True, "amount": amount, "unit": unit,
            "liters": amount if unit == "liters" else None,
            "steps": steps, "already_running": True,
          })
          return out

        # If on flush, cancel first
        if s.is_flushing() or "FLUSH" in " ".join(
          str(s.last.get(k) or "") for k in ("label0", "label1")
        ).upper():
          steps.append("cancel unexpected flush before start")
          try:
            s.press_labeled("STOP", "CANCEL", wait=2.0)
          except RuntimeError:
            s.cmd("CANCEL", wait=1.0)
            s.cmd("BUTTON0", wait=1.5)
          time.sleep(2.0)
          s.drain(1.5)

        # If already on amount page (left mid-flow), just set amount
        if s.is_amount_page():
          steps.append(f"resume on amount page ({unit})")
          set_amount(s, amount, unit=unit)
        else:
          # Navigate to home if on a menu
          if not s.is_home() and not s.is_running() and not s.is_autostore():
            page = str(s.last.get("page", ""))
            if page == "37":
              pass  # already at run mode
            elif page == "12":
              s.cmd("CANCEL", wait=1.0)
            elif page not in ("4", "37", "29"):
              s.go_home(timeout=10.0)

          # START from home
          if s.is_home() or str(s.last.get("page")) == "4":
            steps.append("START (BUTTON1)")
            s.cmd("BUTTON1", wait=2.0)
            s.wait_page(["37", "29", "10", "32", "40"], timeout=10.0)

          # Select AUTORUN on page 37
          if str(s.last.get("page")) == "37" or "SELECT" in str(
            s.last.get("label0") or ""
          ).upper() or "RUN MODE" in str(s.last.get("label0") or "").upper():
            steps.append(f"select AUTORUN on page {s.last.get('page')}")
            # Prefer button label containing AUTORUN
            btn = s.find_button("AUTORUN", "AUTO RUN", "AUTO")
            if btn:
              # Avoid FILLTANK (usually large button0)
              fill = s.find_button("FILL")
              if btn == fill:
                # try next match manually
                for i in range(0, 5):
                  lab = str(s.last.get(f"button{i}") or "").upper()
                  if "AUTO" in lab and "FILL" not in lab:
                    btn = f"BUTTON{i}"
                    break
              s.cmd(btn, wait=2.0)
            else:
              # Heuristic: large button0 is FILLTANK; AUTORUN is usually button1
              b0 = str(s.last.get("button0") or "").upper()
              b1 = str(s.last.get("button1") or "").upper()
              b2 = str(s.last.get("button2") or "").upper()
              steps.append(f"mode buttons b0={b0!r} b1={b1!r} b2={b2!r}")
              if "AUTO" in b1:
                s.cmd("BUTTON1", wait=2.0)
              elif "AUTO" in b2:
                s.cmd("BUTTON2", wait=2.0)
              elif "FILL" in b0 and "AUTO" not in b0:
                s.cmd("BUTTON1", wait=2.0)
              else:
                s.cmd("BUTTON1", wait=2.0)
            s.wait_page(["29", "10", "32", "12"], timeout=10.0)

          # Amount entry (liters or hours radio + value)
          if s.is_amount_page() or str(s.last.get("page")) == "29":
            steps.append(f"set amount {amount}{unit_label} ({unit})")
            set_amount(s, amount, unit=unit)
          elif str(s.last.get("page")) == "12":
            steps.append(f"direct data {amount} on page 12")
            s.data(str(int(amount)), wait=1.5)
            s.wait_page("29", timeout=5.0)
            if s.is_amount_page():
              select_amount_unit(s, unit)
              s.cmd("BUTTON3", wait=2.0)

        # Wait for system starting / autorun dashboard
        steps.append("wait for start")
        s.wait_page(["10", "32", "30", "31", "39", "6"], timeout=20.0)
        # Watch briefly for FWF divert
        watch_end = time.time() + 25.0
        while time.time() < watch_end:
          s.drain(1.0)
          line = " ".join(
            str(s.last.get(k) or "") for k in ("label0", "label1", "label2")
          ).upper()
          page = str(s.last.get("page", ""))
          if page in ("32", "6") or "AUTORUN" in line:
            steps.append("autorun dashboard reached")
            out = normalize(s.last)
            out.update({
              "ok": True, "amount": amount, "unit": unit,
              "liters": amount if unit == "liters" else None,
              "steps": steps,
            })
            return out
          if "SYSTEM STARTING" in line or page == "10":
            continue
          if "FLUSH" in line and flush_retry:
            steps.append("diverted to freshwater flush — cancel and retry")
            try:
              s.press_labeled("STOP", "CANCEL", wait=2.0)
            except RuntimeError:
              s.cmd("CANCEL", wait=1.0)
              s.cmd("BUTTON0", wait=1.5)
            time.sleep(3.0)
            last_err = "freshwater_flush_divert"
            break
          if page == "4" and s.find_button("START"):
            # bounced home without running
            steps.append("returned home without run")
            last_err = "returned_home"
            break
        else:
          # timed out watch but maybe still starting
          if s.is_running():
            out = normalize(s.last)
            out.update({
              "ok": True, "amount": amount, "unit": unit,
              "liters": amount if unit == "liters" else None,
              "steps": steps, "note": "start_in_progress",
            })
            return out
          last_err = "start_timeout"

    except Exception as e:
      last_err = str(e)
      steps.append(f"error: {e}")
      time.sleep(2.0)

  # Failed after retries
  st = {}
  try:
    st = normalize(read_status(host))
  except Exception:
    pass
  st.update({
    "ok": False, "amount": amount, "unit": unit,
    "liters": amount if unit == "liters" else None,
    "steps": steps, "error": last_err,
  })
  return st


def send_cmd(cmd: str, host: str = DEFAULT_HOST) -> dict:
  """Send a single command; return a status snapshot after."""
  cmd = cmd.strip().upper()
  aliases = {
    "START": "BUTTON1",  # home page only
    "STOP": "__SMART_STOP__",
    "FLUSH": "BUTTON0",
    "FWF": "BUTTON0",
    "FRESH_WATER_FLUSH": "BUTTON0",
    "CANCEL": "CANCEL",
    "HELP": "HELP",
  }
  mapped = aliases.get(cmd, cmd)
  if mapped == "__SMART_STOP__":
    return smart_stop(host)

  with SpectraSession(host) as s:
    s.drain(0.8)
    # Home-page-aware START/FLUSH
    if cmd in ("START", "FLUSH", "FWF", "FRESH_WATER_FLUSH") and not s.is_home():
      if s.is_running() and cmd == "START":
        return s.last
      # For FLUSH while running — don't
      if cmd != "START":
        pass
    page = str(s.last.get("page") or "4")
    if mapped.startswith("BUTTON") or mapped in ("CANCEL", "HELP") or mapped.startswith("LABEL"):
      s.cmd(mapped, wait=1.5)
    else:
      s.cmd(mapped, wait=1.5)
    s.drain(1.0)
    return s.last or {"ok": True, "cmd": mapped, "page": page}


def _num(s) -> float | None:
  if s is None:
    return None
  m = re.search(r"([\d.]+)", str(s))
  return float(m.group(1)) if m else None


def normalize(status: dict) -> dict:
  """Flatten for HA command_line JSON attributes."""
  if not status:
    return {
      "page": None,
      "model": "NEWPORT 400",
      "mode": "offline",
      "status_line": "offline",
      "ok": False,
    }
  g0 = status.get("gauge0_label") or status.get("gauge0")
  g1 = status.get("gauge1_label") or status.get("gauge1")
  g2 = status.get("gauge2_label") or status.get("gauge2")
  label0 = status.get("label0") or ""
  label1 = status.get("label1") or ""
  label2 = status.get("label2") or ""
  label3 = status.get("label3") or ""
  page = str(status.get("page") or "")
  line = f"{label0} {label1} {label2} {label3}".upper()

  # Map gauges by label text. Spectra pairs label1→gauge0, label2→gauge1, …
  # Page 32: Feed Pressure (bar), Filter Condition (%), Quality (ppm).
  # Page 6:  Boost (bar), Feed (bar). Home page 4: gauge0 = tank level %.
  feed_pressure = None
  boost_pressure = None
  tank_percent = None
  filter_pct = None
  product_ppm = None

  gauge_vals = [g0, g1, g2]
  label_vals = [label1, label2, label3, status.get("label4") or ""]
  for i, gval in enumerate(gauge_vals):
    if gval is None or gval == "":
      continue
    lab_u = str(label_vals[i] if i < len(label_vals) else "").upper()
    gs = str(gval)
    n = _num(gval)
    if "FILTER" in lab_u and n is not None:
      filter_pct = n
    elif "QUALITY" in lab_u or "PPM" in gs.upper():
      if n is not None:
        product_ppm = n
    elif "BOOST" in lab_u:
      boost_pressure = gs if "bar" in gs.lower() else (f"{n}bar" if n is not None else gs)
    elif "FEED" in lab_u:
      feed_pressure = gs if "bar" in gs.lower() else (f"{n}bar" if n is not None else gs)
    elif "TANK" in lab_u and n is not None:
      tank_percent = n
    elif "bar" in gs.lower() and feed_pressure is None:
      # unlabeled bar: first bar = feed (or boost if already have feed)
      feed_pressure = gs
    elif "%" in gs and filter_pct is None and "bar" not in gs.lower():
      filter_pct = n
    elif "ppm" in gs.lower() and product_ppm is None:
      product_ppm = n

  # Home / idle: plain % on gauge0 is tank level (not filter)
  if (
    page in ("4", "2")
    and feed_pressure is None
    and product_ppm is None
    and g0 is not None
    and "bar" not in str(g0).lower()
  ):
    tank_percent = _num(g0)
    # During FWF, gauge is progress % — don't call it filter
    if "FLUSH" not in line:
      pass
    else:
      filter_pct = None  # FWF progress is not filter condition

  tank_raw = status.get("tank")
  try:
    tank_raw_f = float(tank_raw) if tank_raw is not None else None
  except (TypeError, ValueError):
    tank_raw_f = None

  model = "NEWPORT 400"
  if "NEWPORT" in str(label0).upper() or "SPECTRA" in str(label0).upper():
    model = label0
  mode = label0 if label0 and model != label0 else (label1 or label0)
  autostore = label1 if "autostore" in str(label1).lower() else (
    label1 if page == "4" else ""
  )
  alarm = status.get("alarm")
  if isinstance(alarm, str) and alarm.upper() in ("OFF", "0", "FALSE", "NONE", ""):
    alarm = None

  running = not is_autostore_screen(page, f"{label0} {label1}") and (
    page in ("6", "10", "30", "31", "32", "33", "39")
    or "AUTORUN" in line
    or "SYSTEM STARTING" in line
  )
  flushing = ("FLUSH" in line and page not in ("4",)) or (
    "WATER FLUSH" in line
  )

  # Prefer a human status line: during autorun show mode title
  if "AUTORUN" in str(label0).upper():
    status_line = label0
  elif "SYSTEM STARTING" in str(label1).upper() or "SYSTEM STARTING" in str(label0).upper():
    status_line = label1 or label0
  elif "FLUSH" in str(label0).upper():
    status_line = f"{label0} — {label1}".strip(" —")
  else:
    status_line = label1 or label0
  # Strip HTML fragments from device strings (e.g. Remaining time : 5m<br/>)
  if status_line:
    status_line = re.sub(r"<[^>]+>", " ", str(status_line))
    status_line = re.sub(r"\s+", " ", status_line).strip()

  return {
    "page": status.get("page"),
    "model": model,
    "mode": mode,
    "status_line": status_line,
    "tank_label": label2,
    "extra_label": status.get("label4") or label3,
    "button0": status.get("button0"),
    "button1": status.get("button1"),
    "button2": status.get("button2"),
    "button3": status.get("button3"),
    "gauge0": status.get("gauge0"),
    "gauge0_label": status.get("gauge0_label"),
    "gauge1_label": status.get("gauge1_label"),
    "gauge2_label": status.get("gauge2_label"),
    "tank_raw": tank_raw_f,
    "tank_percent": tank_percent,
    "filter_percent": filter_pct,
    "product_ppm": product_ppm,
    "autostore": autostore,
    "alarm": alarm,
    "warning": status.get("warning"),
    "running": running,
    "flushing": flushing,
    "feed_pressure": feed_pressure,
    "boost_pressure": boost_pressure,
    "raw": status,
  }


def compute_liters_from_env() -> tuple[float, str]:
  """Optional: SPECTRA_FWD_PCT / SPECTRA_AFT_PCT (0-100) → shortfall liters.

  Returns (liters, reason). Defaults to DEFAULT_AUTORUN_L when levels unknown.
  """
  fwd = os.environ.get("SPECTRA_FWD_PCT")
  aft = os.environ.get("SPECTRA_AFT_PCT")
  # Also accept combined SPECTRA_FRESH_PCT for a single combined sensor
  combined = os.environ.get("SPECTRA_FRESH_PCT")

  def _shortfall(pct_s: str | None, capacity: float) -> float | None:
    if pct_s is None or pct_s == "":
      return None
    try:
      pct = float(pct_s)
    except ValueError:
      return None
    if pct < 0 or pct > 100:
      return None
    return max(0.0, (100.0 - pct) / 100.0 * capacity)

  if fwd is not None or aft is not None:
    sf = 0.0
    parts = []
    a = _shortfall(fwd, TANK_FWD_L)
    b = _shortfall(aft, TANK_AFT_L)
    if a is not None:
      sf += a
      parts.append(f"fwd shortfall {a:.0f}L")
    if b is not None:
      sf += b
      parts.append(f"aft shortfall {b:.0f}L")
    if a is None and b is None:
      return DEFAULT_AUTORUN_L, "levels invalid → default"
    # Cap at total capacity; floor at 1 L so Spectra accepts
    sf = max(1.0, min(sf, TANK_FWD_L + TANK_AFT_L))
    return round(sf), " + ".join(parts) if parts else "tank shortfall"

  if combined is not None and combined != "":
    total_cap = TANK_FWD_L + TANK_AFT_L
    sf = _shortfall(combined, total_cap)
    if sf is None:
      return DEFAULT_AUTORUN_L, "combined level invalid → default"
    return round(max(1.0, sf)), f"combined shortfall {sf:.0f}L"

  return DEFAULT_AUTORUN_L, "no marine levels → default 400 L"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str]) -> int:
  if len(argv) < 2 or argv[1] in ("-h", "--help"):
    print(__doc__)
    return 2
  action = argv[1].lower()

  if action == "status":
    host = argv[2] if len(argv) > 2 else DEFAULT_HOST
    st = normalize(read_status(host))
    print(json.dumps(st, separators=(",", ":")))
    return 0

  if action == "cmd":
    if len(argv) < 3:
      print("cmd requires BUTTON0/1/2 or START/STOP/FLUSH/CANCEL", file=sys.stderr)
      return 2
    cmd = argv[2]
    host = argv[3] if len(argv) > 3 else DEFAULT_HOST
    st = normalize(send_cmd(cmd, host))
    print(json.dumps(st, separators=(",", ":")))
    return 0

  if action == "stop":
    host = argv[2] if len(argv) > 2 else DEFAULT_HOST
    st = normalize(smart_stop(host))
    st["ok"] = True
    print(json.dumps(st, separators=(",", ":")))
    return 0

  if action == "cancel_flush":
    host = argv[2] if len(argv) > 2 else DEFAULT_HOST
    st = normalize(cancel_flush(host))
    st["ok"] = True
    print(json.dumps(st, separators=(",", ":")))
    return 0

  if action == "autorun":
    # autorun [amount] [liters|hours] [host]
    # autorun 400
    # autorun 400 liters
    # autorun 2 hours
    # autorun auto|tanks
    amount = DEFAULT_AUTORUN_L
    unit = "liters"
    host = DEFAULT_HOST
    args = argv[2:]
    i = 0
    if args and args[0] in ("auto", "tanks", "from_tanks"):
      amount, reason = compute_liters_from_env()
      unit = "liters"
      i = 1
      if i < len(args) and args[i] not in ("liters", "hours", "l", "h", "hr", "hrs"):
        # optional host after auto
        if not re.match(r"^\d", args[i]):
          host = args[i]
          i += 1
      result = autorun(amount, host, unit=unit)
      result["liters_reason"] = reason
      print(json.dumps(result, separators=(",", ":")))
      return 0 if result.get("ok") else 1

    if args and re.match(r"^\d+(\.\d+)?$", args[0]):
      amount = float(args[0])
      i = 1
    if i < len(args) and args[i].lower() in (
      "liters", "liter", "litres", "l", "hours", "hour", "h", "hr", "hrs"
    ):
      unit = args[i].lower()
      i += 1
    if i < len(args):
      host = args[i]
    result = autorun(amount, host, unit=unit)
    print(json.dumps(result, separators=(",", ":")))
    return 0 if result.get("ok") else 1

  if action == "raw":
    # raw PAGE CMD_OR_data:VAL [host]
    if len(argv) < 4:
      print("raw PAGE CMD|data:VALUE [host]", file=sys.stderr)
      return 2
    page, payload = argv[2], argv[3]
    host = argv[4] if len(argv) > 4 else DEFAULT_HOST
    with SpectraSession(host) as s:
      s.drain(0.5)
      if payload.lower().startswith("data:"):
        s.send({"page": page, "data": payload.split(":", 1)[1]}, wait=2.0)
      else:
        s.send({"page": page, "cmd": payload}, wait=2.0)
      st = normalize(s.last)
    print(json.dumps(st, separators=(",", ":")))
    return 0

  print("unknown action", action, file=sys.stderr)
  return 2


if __name__ == "__main__":
  sys.exit(main(sys.argv))
